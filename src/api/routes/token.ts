import { Router } from 'express';
import type { Request, Response } from 'express';
import crypto from 'crypto';
import { supabase } from '../../db/supabase.js';

export interface SetupTokenData {
  expiresAt: number;
  userId: string;
}

export const activeSetupTokens = new Map<string, SetupTokenData>();

const router = Router();

router.post('/generate-setup-token', async (req: Request, res: Response) => {
  let userId = req.body?.userId;

  // Validate JWT from Authorization header if present
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const jwt = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(jwt);
    if (!error && user) {
      userId = user.id;
    }
  }

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid Supabase user session.' });
  }

  const setupToken = `vtx_${crypto.randomBytes(8).toString('hex')}`;
  const ttlMs = 15 * 60 * 1000;
  const expiresAt = Date.now() + ttlMs;

  // Bind token to the authenticated Supabase user_id
  activeSetupTokens.set(setupToken, { expiresAt, userId });

  const host = 'api.pulseops.yivibro.in';

  res.status(201).json({
    setupToken,
    expiresAt,
    command: `curl -sSL https://${host}/install.sh | sudo bash -s -- "${setupToken}" "https://${host}"`
  });
});

export default router;
