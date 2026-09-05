import { Redis } from 'ioredis';
import { writeMetric } from './writer.js';
import { emitMetric } from '../sockets/liveMetrics.js';

const REDIS_HOST = process.env.REDIS_HOST || 'pulseops-redis';
const redis = new Redis(REDIS_HOST);

const STREAM_KEY = 'metrics:stream';
const GROUP_NAME = 'metrics-consumer-group';
const CONSUMER_NAME = `consumer-${process.pid}`;

// Ensure stream and consumer group exist
async function ensureConsumerGroup() {
  try {
    await redis.xgroup('CREATE', STREAM_KEY, GROUP_NAME, '0', 'MKSTREAM');
  } catch (err: any) {
    if (!err.message.includes('BUSYGROUP')) throw err;
  }
}

// Process an individual stream message
async function processMessage(id: string, fields: string[]) {
  try {
    // Parse Redis hash fields into an object
    const rawData: Record<string, string> = {};
    for (let i = 0; i < fields.length; i += 2) {
	const key = fields[i];
	const val = fields[i+1];
	
	if (typeof key === 'string' && typeof val === 'string') {
        	rawData[key] = val;
      }	

    }

    // Extract payload (handles either raw string or nested 'payload' field)
    const jsonStr = rawData.payload || rawData.data || Object.values(rawData)[0];
    if (!jsonStr) return;

    const payload = JSON.parse(jsonStr);
    const metrics = Array.isArray(payload.metrics) ? payload.metrics : [payload];

    for (const m of metrics) {
      const metricData = {
        serverId: m.serverId || payload.serverId || 'unknown-server',
        cpu: Number(m.cpu) || 0,
        memory: Number(m.memory) || 0,
        disk: Number(m.disk) || 0,
        timestamp: m.timestamp || new Date().toISOString(),
      };

      // 1. Buffer for database batch insert
      await writeMetric(metricData);

      // 2. Emit live metrics directly to Socket.IO dashboard
      emitMetric(metricData);
    }
  } catch (err) {
    console.error(`[CONSUMER] Error processing message ${id}:`, err);
  }
}

// Main infinite reading loop
export async function consumeLoop() {
  await ensureConsumerGroup();
  console.log('[CONSUMER] Listening for metrics on stream:', STREAM_KEY);

  while (true) {
    try {
      const response = await redis.xreadgroup(
        'GROUP', GROUP_NAME, CONSUMER_NAME,
        'COUNT', 10,
        'BLOCK', 2000,
        'STREAMS', STREAM_KEY, '>'
      );

      if (!response) continue;

      const [, messages] = response[0] as [string, [string, string[]][]];

      for (const [id, fields] of messages) {
        await processMessage(id, fields);
        await redis.xack(STREAM_KEY, GROUP_NAME, id);
      }
    } catch (err) {
      console.error('[CONSUMER LOOP ERROR]', err);
      await new Promise((res) => setTimeout(res, 2000));
    }
  }
}
