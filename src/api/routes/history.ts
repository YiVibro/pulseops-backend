import { Router } from 'express';
import type { Request, Response } from 'express';
import { influxClient, database } from '../../db/influx.js';

const router = Router();

// GET /api/metrics/history?serverId=node-123&hours=1
router.get('/', async (req: Request, res: Response) => {
  console.log('[HISTORY ROUTE MATCHED] Querying InfluxDB...');

  const serverId = req.query.serverId as string;
  const hours = parseInt((req.query.hours as string) || '24', 10);

  // InfluxDB 3.0 SQL Engine
  let query = `SELECT time, "serverId", cpu, memory, disk FROM system_metrics WHERE time >= now() - INTERVAL '${hours} HOURS'`;

  if (serverId) {
    query += ` AND "serverId" = '${serverId}'`;
  }

  query += ` ORDER BY time ASC`;

  const history: any[] = [];

  try {
    const reader = await influxClient.query(query, database);

    for await (const row of reader) {
      history.push({
        timestamp: row.time,
        serverId: row.serverId,
        cpu: Number(row.cpu || 0),
        memory: Number(row.memory || 0),
        disk: Number(row.disk || 0),
      });
    }

    return res.status(200).json({
      status: 'success',
      count: history.length,
      data: history,
    });
  } catch (err: any) {
    console.error('================ INFLUXDB ROUTE ERROR ================');
    console.error(err);
    console.error('======================================================');
    return res.status(500).json({
      error: 'Failed to fetch history from InfluxDB',
      details: err?.message || String(err),
      stack: err?.stack, // ✅ Semicolon replaced with comma
    });
  }
});

export default router;
