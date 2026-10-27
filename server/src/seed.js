import bcrypt from 'bcryptjs';
import Room from './models/Room.js';
import User from './models/User.js';

const SAMPLE_ROOMS = [
  { name: 'L1-01 Focus Pod', building: 'Central Library', capacity: 2, amenities: ['power', 'quiet'], openMinute: 480, closeMinute: 1320 },
  { name: 'L1-04 Group Room', building: 'Central Library', capacity: 6, amenities: ['whiteboard', 'power', 'ac'], openMinute: 480, closeMinute: 1320 },
  { name: 'L2-10 Seminar Room', building: 'Central Library', capacity: 12, amenities: ['projector', 'whiteboard', 'ac', 'power'], openMinute: 540, closeMinute: 1260 },
  { name: 'E-201 Project Lab', building: 'Engineering Block', capacity: 8, amenities: ['tv', 'whiteboard', 'power'], openMinute: 540, closeMinute: 1080 },
  { name: 'E-305 Huddle', building: 'Engineering Block', capacity: 4, amenities: ['tv', 'power'], openMinute: 540, closeMinute: 1080 },
];

/** Idempotent startup seeding: sample rooms on an empty DB, admin from env. */
export async function seed() {
  if ((await Room.estimatedDocumentCount()) === 0) {
    await Room.insertMany(SAMPLE_ROOMS);
    console.log(`Seeded ${SAMPLE_ROOMS.length} sample rooms`);
  }
  const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    const email = ADMIN_EMAIL.toLowerCase();
    const existing = await User.findOne({ email });
    if (!existing) {
      await User.create({ name: 'Admin', email, role: 'admin', passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10) });
      console.log(`Created admin account ${email}`);
    } else if (existing.role !== 'admin') {
      existing.role = 'admin';
      await existing.save();
    }
  }
}
