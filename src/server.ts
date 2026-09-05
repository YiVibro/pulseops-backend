import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import http from 'http';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import { initSocket } from './sockets/liveMetrics.js';
import { consumeLoop } from './ingestion/consumer.js';
import metricsRouter from './api/routes/metrics.js';
import authRouter from './api/routes/auth.js';
import ServerRouter from './api/routes/servers.js';
import generateToken from './api/routes/token.js';
import registerRouter from './api/routes/register.js';
import historyRouter from './api/routes/history.js';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

const app = express();
const httpServer = http.createServer(app);

app.use(cors({
  origin: '*',
credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Serve Installer Script
app.get('/install.sh', (req, res) => {
  const scriptPath = path.resolve(dirname, '../public/install.sh');
  res.setHeader('Content-Type', 'text/plain');
  res.sendFile(scriptPath, (err) => {
    if (err) {
      console.error('[ERROR] Failed to serve install.sh:', err);
      res.status(404).send('echo "Error: install.sh not found on server."');
    }
  });
});

// Serve Native Shell Collector Payload
app.get('/collector.sh', (req, res) => {
  const scriptPath = path.resolve(dirname, '../public/collector.sh');
  res.setHeader('Content-Type', 'text/x-shellscript');
  res.sendFile(scriptPath, (err) => {
    if (err) {
      console.error('[ERROR] Failed to serve collector.sh:', err);
      res.status(404).send('echo "Error: collector.sh not found on server."');
    }
  });
});

// API Routes
app.use('/api/metrics/history', historyRouter);
app.use('/api/metrics', metricsRouter);
app.use('/api/servers', ServerRouter);
app.use('/api/token', generateToken);
app.use('/api/auth', authRouter);
app.use('/api', registerRouter);

// Initialize WebSockets
initSocket(httpServer);

// Start Redis Stream Consumer Loop
consumeLoop().catch(console.error);

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
