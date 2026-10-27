import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import User from '../models/User.js';
import { HttpError, asyncHandler, validate } from '../lib/errors.js';
import { requireAuth, signToken } from '../middleware/auth.js';

const router = Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many attempts, try again in a few minutes' } });

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
});
const loginSchema = z.object({ email: z.string().trim().toLowerCase().email('Enter a valid email'), password: z.string().min(1, 'Password is required') });

router.post('/register', limiter, asyncHandler(async (req, res) => {
  const { name, email, password } = validate(registerSchema, req.body);
  if (await User.exists({ email })) throw new HttpError(409, 'An account with this email already exists');
  const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 10) });
  res.status(201).json({ token: signToken(user), user });
}));

router.post('/login', limiter, asyncHandler(async (req, res) => {
  const { email, password } = validate(loginSchema, req.body);
  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw new HttpError(401, 'Incorrect email or password');
  res.json({ token: signToken(user), user });
}));

router.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));

export default router;
