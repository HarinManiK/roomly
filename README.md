# Roomly – Study-Room Booking Platform

Roomly lets students find and reserve campus study rooms with live availability, and lets administrators manage rooms and oversee bookings. It's built on the MERN stack (MongoDB, Express, React, Node.js).

**Live app:** https://roomly-ue3c.onrender.com · **Demo video:** https://drive.google.com/file/d/1Z34QQiT6lBMb3TwpWSU856tFldLl8dse/view?usp=sharing

> The app runs on Render's free tier. If nobody has used it for 15 minutes, the first request can take about 50 seconds while the server wakes up.

---

## Problem Statement

Group study rooms on most campuses are booked with a paper sheet on the door, a shared spreadsheet, or nothing at all. This causes three recurring problems:

- **Double bookings and disputes.** Two groups turn up for the same room because nothing stops them both claiming it.
- **No visibility.** Students walk between buildings looking for a free room, with no way to check before they go.
- **Hoarding.** A few people reserve rooms for whole days, while rooms that were reserved and then abandoned sit empty.

## Target Users

- **Students** who need a room for group work, interviews, project meetings or quiet study.
- **Campus administrators** (library or facilities staff) who own the rooms and need to see and manage how they're used.

## Solution

Roomly is a single source of truth for room availability with the booking rules enforced in software:

- Each room's day is divided into 30-minute slots, and students can see which slots are free before they leave their seat.
- A booking is checked against the room's opening hours, capacity, a maximum length, and how far ahead it is. It is also checked against the student's other bookings, so one person can't hold two rooms at the same time.
- **Double-booking is impossible, even under concurrent requests.** The database enforces it, not just the UI (see [Architecture](#architecture)).
- Fair-use limits (2 hours per booking, at most 3 upcoming bookings per student) stop hoarding. Cancelling a booking frees its slots for others immediately.

## Key Features / Workflows

1. **Sign up and log in.** Accounts use hashed passwords and JWT sessions, and there are two roles: student and admin.
2. **Search for a free room.** Filter by name or building, group size and amenities (projector, whiteboard, TV…). You can also search for a specific date and time window, which returns only rooms that are open and completely free for that window.
3. **Book a slot.** Pick a day (up to 14 days ahead) and select up to four adjacent 30-minute slots on the room's colour-coded grid (free / booked / yours / past). Enter the number of attendees and a purpose, then confirm. The server checks every rule; if someone grabs the slot first, you get a clear message and the grid refreshes.
4. **Manage your bookings.** See upcoming bookings and history, and cancel upcoming ones, which frees the slot straight away. Past bookings can't be cancelled.
5. **Admin console.** Add and edit rooms (capacity, hours, amenities, bookable on/off), see every booking for any date, and cancel any booking. Roomly refuses room edits that would break existing bookings (for example, shortening the hours under a booked slot or deactivating a room that has upcoming bookings).

Every screen has loading, empty, success and error states: toasts for actions, inline form errors, and messages for network failures and expired sessions.

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | React 18, React Router, Vite | Component-based SPA with client-side routing and a fast build |
| Backend | Node.js 22, Express 5 | Small, explicit REST API |
| Database | MongoDB Atlas + Mongoose | Flexible documents; unique multikey indexes give atomic conflict prevention |
| Auth | bcryptjs, JSON Web Tokens | Stateless sessions; passwords are never stored in plain text |
| Validation | Zod | One schema per endpoint, with readable field errors |
| Security | Helmet, express-rate-limit | Secure headers; brute-force protection on login and register |
| Tests | node:test, Supertest, mongodb-memory-server | Real HTTP and real MongoDB in tests, with no external services |
| Hosting | Render (one web service) | Serves the API and the built React app from one origin, so no CORS setup |

## Architecture

```
Browser (React SPA)
   │  fetch /api/*  (Authorization: Bearer <JWT>)
   ▼
Express app ──────────────────────────────────────────────┐
   ├─ helmet, JSON body limit, rate limiter on /auth      │
   ├─ requireAuth / requireAdmin middleware (JWT → user)  │
   ├─ routes/auth.js      register · login · me           │
   ├─ routes/rooms.js     search · details · availability │
   │                      admin create/update             │
   ├─ routes/bookings.js  create · mine · cancel · admin  │
   ├─ lib/bookingService.js  ← all booking business rules │
   ├─ lib/time.js            timezone-aware slot maths    │
   └─ static client/dist (production)                     │
   ▼                                                      │
MongoDB: users · rooms · bookings ◄───────────────────────┘
```

### Data model

- **User**: name, email (unique), passwordHash, role (`student` | `admin`).
- **Room**: name (unique), building, capacity, amenities[], openMinute, closeMinute, isActive.
- **Booking**: room, user, date (`YYYY-MM-DD`), startMinute, endMinute, **slots[]** (the 30-minute slot indexes it covers), attendees, purpose, status (`confirmed` | `cancelled`), plus who cancelled it and when.

### How double-booking is prevented

Checking "is the slot free?" and then inserting the booking is a classic race: two requests can both pass the check before either one writes. Roomly closes this gap in the database. Each booking stores the slot indexes it covers, and the `bookings` collection has this index:

```js
{ room: 1, date: 1, slots: 1 }, { unique: true, partialFilterExpression: { status: 'confirmed' } }
```

Because `slots` is an array, MongoDB treats every element as its own index key. So two *confirmed* bookings for the same room and date can never share a slot, and the second insert fails atomically with a duplicate-key error. The API turns that error into a friendly `409 Conflict`. Cancelled bookings fall outside the partial index, so cancelling frees the slots instantly. The test suite fires two simultaneous requests for the same slot and checks that exactly one succeeds.

### Booking rules (`server/src/lib/bookingService.js`)

| Rule | Error |
|---|---|
| Room must exist and be bookable | 404 |
| Times on 30-minute boundaries, end after start | 400 |
| At most 2 hours | 400 |
| Within the room's opening hours | 400 |
| Attendees ≤ room capacity | 400 |
| Not in the past, and at most 14 days ahead | 400 |
| At most 3 upcoming bookings per student | 409 |
| Student has no overlapping booking in another room | 409 |
| Slot not already taken (DB-enforced) | 409 |
| Only the owner or an admin can cancel; past or cancelled bookings can't be cancelled | 403 / 409 |

**Timezones:** booking times are campus wall-clock times (default `Asia/Kolkata`). Render's server clock runs in UTC, so "now" is always worked out in `APP_TIMEZONE`. Without this, the past-booking checks would be off by several hours.

## Local Setup

Prerequisites: Node.js 20+ and a MongoDB connection string (a free Atlas cluster, or a local `mongod`).

```bash
git clone https://github.com/HarinManiK/roomly.git
cd roomly
cp server/.env.example server/.env    # then edit the values
npm install --prefix server
npm install --prefix client
```

Run the API and the React dev server in two terminals:

```bash
npm run dev:server     # http://localhost:4000
npm run dev:client     # http://localhost:5173 (proxies /api to :4000)
```

On first start with an empty database, Roomly creates 5 sample rooms. If `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set, it also creates an admin account with them.

To run the tests (they download a temporary MongoDB binary the first time, so no database setup is needed):

```bash
npm test
```

For a production-style build:

```bash
npm run build && npm start   # serves the SPA and API on :4000
```

## Environment Variables

All variables are set on the server (`server/.env` locally, or the Render dashboard). Never commit real values.

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | yes | MongoDB connection string, e.g. `mongodb+srv://<user>:<password>@<cluster>/roomly` |
| `JWT_SECRET` | yes | Long random string used to sign login tokens |
| `ADMIN_EMAIL` | no | Email of the admin account to create or ensure on startup |
| `ADMIN_PASSWORD` | no | Password for that admin account (used only when the account is first created) |
| `APP_TIMEZONE` | no | IANA timezone for booking times (default `Asia/Kolkata`) |
| `PORT` | no | HTTP port (default `4000`; Render sets this automatically) |

## Deployment

Roomly runs as a **single Render web service** with a **MongoDB Atlas** free cluster.

1. **Atlas:** create a free M0 cluster, add a database user, allow network access from `0.0.0.0/0`, and copy the connection string.
2. **Render:** New → Blueprint → select this repository. Render reads [`render.yaml`](render.yaml):
   - build: `npm run build` (installs both packages and builds the React app)
   - start: `npm start`
   - health check: `/api/health`
3. Enter `MONGODB_URI` when prompted. `JWT_SECRET` is generated automatically.
4. Open the `.onrender.com` URL and register an account. To make that account an admin, run `npm run make-admin --prefix server -- you@example.com` locally, with `MONGODB_URI` in `server/.env`. You can also set `ADMIN_EMAIL` and `ADMIN_PASSWORD` on the service.

## Project Structure

```
├── client/                 React SPA (Vite)
│   └── src/
│       ├── api.js          fetch wrapper, auth token, date helpers
│       ├── context.jsx     auth + toast providers
│       ├── App.jsx         routes and protected routes
│       └── pages/          Login, Rooms, RoomDetail, MyBookings, Admin
├── server/
│   ├── src/
│   │   ├── index.js        connect DB, sync indexes, seed, listen
│   │   ├── app.js          Express app, error handling, static hosting
│   │   ├── models/         User, Room, Booking
│   │   ├── routes/         auth, rooms, bookings
│   │   ├── middleware/     JWT auth and admin guard
│   │   └── lib/            booking rules, time maths, errors
│   └── test/               integration tests
├── render.yaml             Render blueprint
└── package.json            root build/start scripts
```

## Possible Next Steps

- Email reminders and auto-release of rooms nobody checks in to (QR check-in at the door).
- Recurring bookings for weekly study groups.
- Usage analytics for administrators (peak hours, under-used rooms).
