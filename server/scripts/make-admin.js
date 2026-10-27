// Promote an existing account to admin: npm run make-admin --prefix server -- user@example.com
import mongoose from 'mongoose';
import User from '../src/models/User.js';

const email = process.argv[2]?.toLowerCase();
if (!email || !process.env.MONGODB_URI) {
  console.error('Usage: MONGODB_URI=... node scripts/make-admin.js <email>');
  process.exit(1);
}
await mongoose.connect(process.env.MONGODB_URI);
const user = await User.findOneAndUpdate({ email }, { role: 'admin' }, { returnDocument: 'after' });
console.log(user ? `${user.email} is now an admin` : `No account found for ${email}. Register it in the app first.`);
await mongoose.disconnect();
process.exit(user ? 0 : 1);
