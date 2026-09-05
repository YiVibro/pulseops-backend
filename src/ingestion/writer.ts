import { influxClient, database, Point } from '../db/influx.js';

export interface Metric {
  serverId: string;
  cpu: number;
  memory: number;
  disk: number;
  timestamp: string | number;
}

export async function writeMetric(metric: Metric) {
  try {
    const point = Point.measurement('system_metrics')
      .setTag('serverId', metric.serverId)
      .setFloatField('cpu', Number(metric.cpu))
      .setFloatField('memory', Number(metric.memory))
      .setFloatField('disk', Number(metric.disk));

    // Write directly using InfluxDB v3 client write API
    await influxClient.write(point, database);
  } catch (err) {
    console.error('[INFLUXDB v3 WRITE ERROR]', err);
  }
}

// Optional helper function to query past metrics using InfluxDB v3 SQL engine
export async function getHistoricalMetrics(serverId: string, hours = 24) {
  const query = `
    SELECT * FROM 'system_metrics'
    WHERE time >= now() - interval '${hours} hours'
    AND 'serverId' = '${serverId}'
    ORDER BY time ASC
  `;

  const rows = await influxClient.query(query, database);
  const results = [];

  for await (const row of rows) {
    results.push(row);
  }

  return results;
}
