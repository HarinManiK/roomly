import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import Booking from '../models/Booking.js';
import { HttpError, asyncHandler, validate } from '../lib/errors.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { cancelBooking, createBooking, upcomingFilter } from '../lib/bookingService.js';
import { isValidDate, parseTime, nowInZone } from '../lib/time.js';

const router = Router();
router.use(requireAuth);

const createSchema = z.object({
  roomId: z.string().refine(mongoose.isValidObjectId, 'Invalid room'),
  date: z.string().refine(isValidDate, 'Use a YYYY-MM-DD date'),
  start: z.string().refine((s) => parseTime(s) !== null, 'Use HH:MM time'),
  end: z.string().refine((s) => parseTime(s) !== null, 'Use HH:MM time'),
  attendees: z.coerce.number().int().min(1, 'At least 1 attendee').max(100),
  purpose: z.string().trim().max(140).optional().default(''),
});

router.post('/', asyncHandler(async (req, res) => {
  const v = validate(createSchema, req.body);
  const booking = await createBooking(req.user, { ...v, startMinute: parseTime(v.start), endMinute: parseTime(v.end) });
  res.status(201).json({ booking });
}));

// The current user's bookings, split into upcoming and history.
router.get('/mine', asyncHandler(async (req, res) => {
  const upcoming = await Booking.find(upcomingFilter({ user: req.user._id })).sort({ date: 1, startMinute: 1 }).populate('room');
  const ids = upcoming.map((b) => b._id);
  const history = await Booking.find({ user: req.user._id, _id: { $nin: ids } }).sort({ date: -1, startMinute: -1 }).limit(50).populate('room');
  res.json({ upcoming, history });
}));

// Admin: all bookings for a date.
router.get('/', requireAdmin, asyncHandler(async (req, res) => {
  const date = req.query.date && isValidDate(req.query.date) ? req.query.date : nowInZone().date;
  const bookings = await Booking.find({ date }).sort({ startMinute: 1 }).populate('room').populate('user', 'name email');
  res.json({ date, bookings });
}));

router.post('/:id/cancel', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(404, 'Booking not found');
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw new HttpError(404, 'Booking not found');
  await cancelBooking(booking, req.user);
  res.json({ booking: await booking.populate('room') });
}));

export default router;
