import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { seed } from '../src/seed.js';
import Room from '../src/models/Room.js';
import { addDays, nowInZone } from '../src/lib/time.js';

let mongo, app, token, token2, room;
const tomorrow = addDays(nowInZone().date, 1);

before(async () => {
  process.env.JWT_SECRET = 'test-secret';
  process.env.ADMIN_EMAIL = 'admin@test.local';
  process.env.ADMIN_PASSWORD = 'admin-pass-123';
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await mongoose.model('Booking').syncIndexes();
  await seed();
  app = createApp();
  const reg = async (email) => (await request(app).post('/api/auth/register').send({ name: 'Test User', email, password: 'password123' })).body.token;
  token = await reg('a@test.local');
  token2 = await reg('b@test.local');
  room = await Room.findOne({ name: 'L1-04 Group Room' });
});
after(async () => { await mongoose.disconnect(); await mongo.stop(); });

const book = (t, body) => request(app).post('/api/bookings').set('Authorization', `Bearer ${t}`)
  .send({ roomId: String(room._id), date: tomorrow, attendees: 2, ...body });

test('rejects unauthenticated access', async () => {
  assert.equal((await request(app).get('/api/rooms')).status, 401);
});

test('rejects duplicate registration and bad login', async () => {
  const dup = await request(app).post('/api/auth/register').send({ name: 'X Y', email: 'a@test.local', password: 'password123' });
  assert.equal(dup.status, 409);
  const bad = await request(app).post('/api/auth/login').send({ email: 'a@test.local', password: 'wrong' });
  assert.equal(bad.status, 401);
});

test('books a slot and blocks overlapping bookings', async () => {
  assert.equal((await book(token, { start: '10:00', end: '11:00' })).status, 201);
  const overlap = await book(token2, { start: '10:30', end: '11:30' });
  assert.equal(overlap.status, 409);
  assert.equal((await book(token2, { start: '11:00', end: '12:00' })).status, 201);
});

test('enforces business rules', async () => {
  assert.equal((await book(token, { start: '13:00', end: '16:00' })).status, 400); // > 2h
  assert.equal((await book(token, { start: '06:00', end: '07:00' })).status, 400); // before opening
  assert.equal((await book(token, { start: '13:15', end: '14:00' })).status, 400); // not on slot boundary
  assert.equal((await book(token, { start: '13:00', end: '14:00', attendees: 50 })).status, 400); // capacity
});

test('concurrent requests for the same slot: exactly one wins', async () => {
  const results = await Promise.all([token, token2].map((t) => book(t, { start: '15:00', end: '16:00' })));
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
});

test('availability, search and cancellation free the slot', async () => {
  const avail = await request(app).get(`/api/rooms/${room._id}/availability?date=${tomorrow}`).set('Authorization', `Bearer ${token}`);
  assert.equal(avail.body.slots.find((s) => s.label === '10:00').status, 'booked');
  const search = await request(app).get(`/api/rooms?date=${tomorrow}&start=10:00&end=11:00`).set('Authorization', `Bearer ${token}`);
  assert.ok(!search.body.rooms.some((r) => r._id === String(room._id)));

  const mine = await request(app).get('/api/bookings/mine').set('Authorization', `Bearer ${token}`);
  const id = mine.body.upcoming.find((b) => b.startMinute === 600)._id;
  assert.equal((await request(app).post(`/api/bookings/${id}/cancel`).set('Authorization', `Bearer ${token2}`)).status, 403);
  assert.equal((await request(app).post(`/api/bookings/${id}/cancel`).set('Authorization', `Bearer ${token}`)).status, 200);
  assert.equal((await book(token2, { start: '10:00', end: '10:30' })).status, 201);
});

test('only admins can create rooms', async () => {
  const body = { name: 'New Room', building: 'Annex', capacity: 4, amenities: ['tv'], open: '09:00', close: '17:00' };
  assert.equal((await request(app).post('/api/rooms').set('Authorization', `Bearer ${token}`).send(body)).status, 403);
  const login = await request(app).post('/api/auth/login').send({ email: 'admin@test.local', password: 'admin-pass-123' });
  assert.equal((await request(app).post('/api/rooms').set('Authorization', `Bearer ${login.body.token}`).send(body)).status, 201);
});
