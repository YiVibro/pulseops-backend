import { Router } from 'express';
import type { Request, Response } from 'express';
import { Redis } from 'ioredis';
import { supabase } from '../../db/supabase.js';

const router = Router();
const REDIS_HOST = process.env.REDIS_HOST || 'pulseops-redis';
const redis = new Redis({
  host: REDIS_HOST,
  lazyConnect: true
});
redis.connect().catch((err) => console.error('[REDIS CONNECT ERROR]', err.message));

// GET /api/metrics/:serverId - Get historical metrics within a time range
router.get('/:serverId', async (req: Request, res: Response, next) => {
  const { serverId } = req.params;
  if (serverId === 'history') return next();

  const rangeHoursMap: Record<string, number> = { '1h': 1, '6h': 6, '24h': 24 };
  const range = (req.query.range as string) || '1h';
  const hours = rangeHoursMap[range] || 1;
  const sinceISO = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  try {
    const [metricsQuery, serverQuery] = await Promise.all([
      supabase
        .from('metrics')
        .select('cpu, memory, disk, time')
        .eq('server_id', serverId)
        .gte('time', sinceISO)
        .order('time', { ascending: true }),
      supabase
        .from('servers')
        .select('label')
        .eq('id', serverId)
        .maybeSingle()
    ]);

    if (metricsQuery.error) {
      return res.status(500).json({ error: metricsQuery.error.message });
    }

    const formattedMetrics = (metricsQuery.data || []).map((m: any) => ({
      timestamp: new Date(m.time).getTime(),
      cpu: m.cpu,
      memory: m.memory,
      disk: m.disk
    }));

    return res.json({
      metrics: formattedMetrics,
      name: serverQuery.data?.label || serverId
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// GET /api/metrics/:serverId/latest - Get the most recent metric entry
router.get('/:serverId/latest', async (req: Request, res: Response) => {
  const { serverId } = req.params;

  try {
    const { data, error } = await supabase
      .from('metrics')
      .select('time, cpu, memory, disk')
      .eq('server_id', serverId)
      .order('time', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json(data || null);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch latest metric' });
  }
});

// POST /api/metrics - Ingestion endpoint for agent telemetry
router.post('/', async (req: Request, res: Response) => {
  try {
    const { serverId } = req.body;

    if (!serverId) {
      return res.status(400).json({ error: 'Missing required serverId field' });
    }

    const payloadString = JSON.stringify(req.body);
    await redis.xadd('metrics:stream', '*', 'payload', payloadString);

    return res.status(200).json({ status: 'success' });
  } catch (error: any) {
    console.error('[METRICS INGEST ERROR]', error.message);
    return res.status(500).json({ error: 'Internal ingestion error' });
  }
});

export default router;
