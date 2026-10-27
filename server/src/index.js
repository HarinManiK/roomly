import mongoose from 'mongoose';
import { createApp } from './app.js';
import { seed } from './seed.js';

const { MONGODB_URI, JWT_SECRET, PORT = 4000 } = process.env;
if (!MONGODB_URI || !JWT_SECRET) {
  console.error('MONGODB_URI and JWT_SECRET must be set (see server/.env.example)');
  process.exit(1);
}

await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
await mongoose.model('Booking').syncIndexes();
await seed();
createApp().listen(PORT, () => console.log(`Roomly API listening on :${PORT}`));
