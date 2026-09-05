import { type Request,type Response,type NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthenticatedRequest extends Request {
  user?: { sub: string; email: string };
}

export function verifySupabaseToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Missing access token' });
  }

  const JWT_SECRET = process.env.SUPABASE_JWT_SECRET || '';

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = { sub: decoded.sub, email: decoded.email };
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}
