import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import Room, { AMENITIES } from '../models/Room.js';
import Booking from '../models/Booking.js';
import { HttpError, asyncHandler, validate } from '../lib/errors.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { roomAvailability, upcomingFilter } from '../lib/bookingService.js';
import { isValidDate, parseTime, slotsFor, nowInZone } from '../lib/time.js';

const router = Router();
router.use(requireAuth);

const time = z.string().refine((s) => parseTime(s) !== null, 'Use HH:MM time').transform(parseTime);
const date = z.string().refine(isValidDate, 'Use a YYYY-MM-DD date');

const searchSchema = z.object({
  q: z.string().trim().max(60).optional(),
  minCapacity: z.coerce.number().int().min(1).max(100).optional(),
  amenities: z.string().optional().transform((s) => (s ? s.split(',').filter(Boolean) : [])),
  date: date.optional(),
  start: time.optional(),
  end: time.optional(),
}).refine((v) => (v.start === undefined) === (v.end === undefined), 'Give both a start and end time')
  .refine((v) => v.start === undefined || v.date, 'Pick a date to search by time')
  .refine((v) => v.start === undefined || v.end > v.start, 'End time must be after start time');

const roomSchema = z.object({
  name: z.string().trim().min(2).max(60),
  building: z.string().trim().min(2).max(60),
  capacity: z.coerce.number().int().min(1).max(100),
  amenities: z.array(z.enum(AMENITIES)).default([]),
  open: time,
  close: time,
  isActive: z.boolean().default(true),
}).refine((v) => v.close > v.open, { message: 'Closing time must be after opening time', path: ['close'] });

const loadRoom = async (id) => {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, 'Room not found');
  const room = await Room.findById(id);
  if (!room) throw new HttpError(404, 'Room not found');
  return room;
};

// Search rooms. When a date+time window is given, only rooms that are open and
// completely free for that window are returned.
router.get('/', asyncHandler(async (req, res) => {
  const f = validate(searchSchema, req.query);
  const filter = {};
  if (!(req.user.role === 'admin' && req.query.includeInactive === 'true')) filter.isActive = true;
  if (f.q) filter.$or = ['name', 'building'].map((k) => ({ [k]: { $regex: f.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }));
  if (f.minCapacity) filter.capacity = { $gte: f.minCapacity };
  if (f.amenities.length) filter.amenities = { $all: f.amenities };
  if (f.start !== undefined) {
    filter.openMinute = { $lte: f.start };
    filter.closeMinute = { $gte: f.end };
    const busy = await Booking.distinct('room', { date: f.date, status: 'confirmed', slots: { $in: slotsFor(f.start - (f.start % 30), f.end) } });
    filter._id = { $nin: busy };
  }
  const rooms = await Room.find(filter).sort({ building: 1, name: 1 });
  res.json({ rooms, amenities: AMENITIES });
}));

router.get('/:id', asyncHandler(async (req, res) => res.json({ room: await loadRoom(req.params.id) })));

router.get('/:id/availability', asyncHandler(async (req, res) => {
  const room = await loadRoom(req.params.id);
  const d = validate(date, req.query.date ?? nowInZone().date);
  const slots = (await roomAvailability(room, d)).map(({ ownerId, ...s }) => ({
    ...s, mine: ownerId ? String(ownerId) === String(req.user._id) : false,
  }));
  res.json({ room, date: d, slots });
}));

router.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const v = validate(roomSchema, req.body);
  if (await Room.exists({ name: v.name })) throw new HttpError(409, 'A room with this name already exists');
  const room = await Room.create({ ...v, openMinute: v.open, closeMinute: v.close });
  res.status(201).json({ room });
}));

router.put('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const room = await loadRoom(req.params.id);
  const v = validate(roomSchema, req.body);
  if (await Room.exists({ name: v.name, _id: { $ne: room._id } })) throw new HttpError(409, 'A room with this name already exists');
  // Shrinking hours/capacity or deactivating must not silently break upcoming bookings.
  const affected = await Booking.countDocuments(upcomingFilter({
    room: room._id,
    $nor: [{ startMinute: { $gte: v.open }, endMinute: { $lte: v.close }, attendees: { $lte: v.capacity } }],
  }));
  const affectedAll = v.isActive ? affected : await Booking.countDocuments(upcomingFilter({ room: room._id }));
  if (affectedAll > 0)
    throw new HttpError(409, `${affectedAll} upcoming booking(s) would no longer fit. Cancel them first or keep the current settings.`);
  Object.assign(room, { ...v, openMinute: v.open, closeMinute: v.close });
  await room.save();
  res.json({ room });
}));

export default router;
