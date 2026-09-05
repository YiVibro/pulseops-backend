import {Server} from 'socket.io';
import { Server as HttpServer } from 'http';

let io: Server;

export function initSocket(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: false    
},
transports: ['polling', 'websocket']
  });

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function emitMetric(metric: {
  serverId: string;
  cpu: number;
  memory: number;
  disk: number;
  timestamp: number;
}) {
  if (!io) return;
  io.emit('metrics:update', metric);
}

export function emitAlert(alert: {
  serverId: string;
  metric: string;
  value: number;
  severity: string;
  message: string;
}) {
  if (!io) return;
  io.emit('alert:new', alert);
}
