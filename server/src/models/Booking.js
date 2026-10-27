import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema(
  {
    room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true }, // YYYY-MM-DD in APP_TIMEZONE
    startMinute: { type: Number, required: true },
    endMinute: { type: Number, required: true },
    // 30-minute slot indexes this booking occupies; see unique index below.
    slots: { type: [Number], required: true },
    purpose: { type: String, trim: true, maxlength: 140, default: '' },
    attendees: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ['confirmed', 'cancelled'], default: 'confirmed' },
    cancelledAt: Date,
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

// Double-booking guard enforced by the database itself. A unique multikey index
// treats every element of `slots` as a key, so two confirmed bookings for the same
// room/date can never share a slot - even if two requests race past the app-level
// availability check at the same moment. Cancelled bookings drop out of the index.
bookingSchema.index(
  { room: 1, date: 1, slots: 1 },
  { unique: true, partialFilterExpression: { status: 'confirmed' }, name: 'no_double_booking' },
);
bookingSchema.index({ user: 1, date: 1, status: 1 });

export default mongoose.model('Booking', bookingSchema);
