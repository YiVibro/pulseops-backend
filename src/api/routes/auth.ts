import { Router, type Request,type Response } from 'express';
import jwt from 'jsonwebtoken';

const router = Router();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@monitor.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const JWT_SECRET = process.env.JWT_SECRET || 'super duper secret';

router.post('/login', (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token });
});

export default router;