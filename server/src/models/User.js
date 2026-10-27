import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['student', 'admin'], default: 'student' },
  },
  { timestamps: true },
);

userSchema.methods.toJSON = function toJSON() {
  return { id: this._id, name: this.name, email: this.email, role: this.role };
};

export default mongoose.model('User', userSchema);
