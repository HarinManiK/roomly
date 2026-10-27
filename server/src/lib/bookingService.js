import Booking from '../models/Booking.js';
import Room from '../models/Room.js';
import { HttpError } from './errors.js';
import {
  SLOT_MINUTES, MAX_BOOKING_MINUTES, MAX_DAYS_AHEAD, MAX_ACTIVE_BOOKINGS,
  nowInZone, addDays, slotsFor, formatTime,
} from './time.js';

/** Confirmed bookings that have not finished yet (relative to app timezone). */
export function upcomingFilter(extra = {}) {
  const now = nowInZone();
  return {
    ...extra,
    status: 'confirmed',
    $or: [{ date: { $gt: now.date } }, { date: now.date, endMinute: { $gt: now.minute } }],
  };
}

/** Business rules that do not depend on other bookings. Throws HttpError. */
export function checkBookingRules(room, { date, startMinute, endMinute, attendees }) {
  if (!room || !room.isActive) throw new HttpError(404, 'Room not found or not bookable');
  if (startMinute % SLOT_MINUTES || endMinute % SLOT_MINUTES)
    throw new HttpError(400, `Times must be on ${SLOT_MINUTES}-minute boundaries`);
  if (endMinute <= startMinute) throw new HttpError(400, 'End time must be after start time');
  if (endMinute - startMinute > MAX_BOOKING_MINUTES)
    throw new HttpError(400, `Bookings can be at most ${MAX_BOOKING_MINUTES / 60} hours long`);
  if (startMinute < room.openMinute || endMinute > room.closeMinute)
    throw new HttpError(400, `${room.name} is open ${formatTime(room.openMinute)}–${formatTime(room.closeMinute)}`);
  if (attendees > room.capacity)
    throw new HttpError(400, `${room.name} holds at most ${room.capacity} people`);

  const now = nowInZone();
  if (date < now.date || (date === now.date && startMinute < now.minute))
    throw new HttpError(400, 'That time has already passed');
  if (date > addDays(now.date, MAX_DAYS_AHEAD))
    throw new HttpError(400, `You can book at most ${MAX_DAYS_AHEAD} days ahead`);
}

/** Book a room. Validates rules, quotas and conflicts; the DB index is the final guard. */
export async function createBooking(user, input) {
  const room = await Room.findById(input.roomId);
  checkBookingRules(room, input);
  const { date, startMinute, endMinute } = input;

  const active = await Booking.countDocuments(upcomingFilter({ user: user._id }));
  if (active >= MAX_ACTIVE_BOOKINGS)
    throw new HttpError(409, `You already have ${MAX_ACTIVE_BOOKINGS} upcoming bookings. Cancel one first.`);

  // A person cannot be in two rooms at once.
  const clash = await Booking.findOne({
    user: user._id, date, status: 'confirmed',
    startMinute: { $lt: endMinute }, endMinute: { $gt: startMinute },
  }).populate('room', 'name');
  if (clash)
    throw new HttpError(409, `You already have ${clash.room.name} booked ${formatTime(clash.startMinute)}–${formatTime(clash.endMinute)} that day`);

  try {
    const booking = await Booking.create({
      room: room._id, user: user._id, date, startMinute, endMinute,
      slots: slotsFor(startMinute, endMinute),
      purpose: input.purpose, attendees: input.attendees,
    });
    return booking.populate('room');
  } catch (err) {
    if (err.code === 11000) throw new HttpError(409, 'Sorry, someone just booked part of that time. Pick another slot.');
    throw err;
  }
}

/** Per-slot availability grid for one room and date. */
export async function roomAvailability(room, date) {
  const bookings = await Booking.find({ room: room._id, date, status: 'confirmed' }).select('slots user');
  const taken = new Map();
  for (const b of bookings) for (const s of b.slots) taken.set(s, b.user);
  const now = nowInZone();
  const slots = [];
  for (let m = room.openMinute; m < room.closeMinute; m += SLOT_MINUTES) {
    const owner = taken.get(m / SLOT_MINUTES);
    const past = date < now.date || (date === now.date && m < now.minute);
    slots.push({ start: m, label: formatTime(m), status: owner ? 'booked' : past ? 'past' : 'free', ownerId: owner ?? null });
  }
  return slots;
}

export async function cancelBooking(booking, actor) {
  const isOwner = String(booking.user._id ?? booking.user) === String(actor._id);
  if (!isOwner && actor.role !== 'admin') throw new HttpError(403, 'You can only cancel your own bookings');
  if (booking.status === 'cancelled') throw new HttpError(409, 'This booking is already cancelled');
  const now = nowInZone();
  if (booking.date < now.date || (booking.date === now.date && booking.endMinute <= now.minute))
    throw new HttpError(409, 'Past bookings cannot be cancelled');
  booking.status = 'cancelled';
  booking.cancelledAt = new Date();
  booking.cancelledBy = actor._id;
  await booking.save();
  return booking;
}
