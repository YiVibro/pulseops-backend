import { InfluxDBClient, Point } from '@influxdata/influxdb3-client';

const host = process.env.INFLUX_HOST || 'https://eu-central-1-1.aws.cloud2.influxdata.com';
const token = process.env.INFLUX_TOKEN || process.env.INFLUXDB_TOKEN || '';
export const database = process.env.INFLUX_BUCKET || 'telemetry';

if (!token) {
  console.error('error: Missing INFLUX_TOKEN environment variable!');
}

export const influxClient = new InfluxDBClient({
  host,
  token,
});

export { Point };
