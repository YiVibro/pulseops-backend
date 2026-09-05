// src/api/routes/servers.ts
import { Router } from 'express';
import type { Request, Response } from 'express';
import { supabase } from '../../db/supabase.js';

const router = Router();

interface ServerRow {
  id: string;
  label: string;
  created_at: string;
}

router.get('/', async (_req: Request, res: Response) => {
  try {
    const { data: servers, error } = await supabase
      .from('servers')
      .select('id, label, created_at')
      .order('created_at', { ascending: true });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const response = ((servers as ServerRow[]) || []).map((s: ServerRow) => ({
      id: s.id,
      name: s.label,
      status: 'healthy',
      history: [
        {
          cpu: 0,
          memory: 0,
          disk: 0,
          timestamp: Date.now(),
        },
      ],
    }));

    return res.json(response);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch servers' });
  }
});

export default router;
