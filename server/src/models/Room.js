import mongoose from 'mongoose';

export const AMENITIES = ['whiteboard', 'projector', 'tv', 'power', 'ac', 'quiet'];

const roomSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    building: { type: String, required: true, trim: true },
    capacity: { type: Number, required: true, min: 1, max: 100 },
    amenities: [{ type: String, enum: AMENITIES }],
    openMinute: { type: Number, required: true, min: 0, max: 1440 },
    closeMinute: { type: Number, required: true, min: 0, max: 1440 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default mongoose.model('Room', roomSchema);
