import { Router } from 'express';
import type { Request, Response } from 'express';
import crypto from 'crypto';
import { activeSetupTokens } from './token.js';
import { supabase } from '../../db/supabase.js';

const router = Router();

router.post('/register', async (req: Request, res: Response) => {
  const { setupToken, hostname } = req.body;

  if (!setupToken) {
    return res.status(400).json({ error: 'Setup token is required.' });
  }

  const tokenData = activeSetupTokens.get(setupToken);

  if (!tokenData) {
    return res.status(401).json({ error: 'Access Denied: Invalid or expired setup token.' });
  }

  const { expiresAt, userId } = tokenData;

  if (Date.now() > expiresAt) {
    activeSetupTokens.delete(setupToken);
    return res.status(401).json({ error: 'Access Denied: Setup token has expired.' });
  }

  if (!userId) {
    return res.status(400).json({ error: 'Registration failed: No user attached to setup token.' });
  }

  activeSetupTokens.delete(setupToken);

  const cleanHost = (hostname || 'linux-node').replace(/[^a-zA-Z0-9-_]/g, '');
  const agentId = `node-${cleanHost}-${crypto.randomBytes(3).toString('hex')}`;
  const permanentAgentToken = `vat_${crypto.randomBytes(24).toString('hex')}`;

  try {
    const payload = {
      id: agentId,
      user_id: userId,
      label: hostname || agentId,
      created_at: new Date().toISOString()
    };

    const { error } = await supabase.from('servers').upsert(payload);

    if (error) {
      console.error('[SUPABASE REGISTRATION ERROR]:', error.message);
      return res.status(500).json({ error: error.message });
    }

    return res.status(201).json({
      status: 'success',
      agentId,
      agentToken: permanentAgentToken,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Internal registration failure' });
  }
});

export default router;
