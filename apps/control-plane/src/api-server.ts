import express, { Express, Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { v4 as uuidv4 } from 'uuid';
import type { Logger } from 'pino';
import { createLogger } from 'pino';

import { ConstellationState, InferenceTask, SystemConfig } from '@orbitalmind/shared';
import { Orchestrator } from './orchestrator';
import satelliteRoutes from './routes/satellites';
import taskRoutes from './routes/tasks';
import telemetryRoutes from './routes/telemetry';
import orchestrationRoutes from './routes/orchestration';
import healthRoutes from './routes/health';

interface APIContext {
  requestId: string;
  timestamp: number;
  userId?: string;
}

declare global {
  namespace Express {
    interface Request {
      context: APIContext;
    }
  }
}

export interface APIServerConfig {
  port: number;
  host: string;
  env: 'development' | 'production' | 'test';
}

export class APIServer {
  private app: Express;
  private server: ReturnType<typeof createServer>;
  private io: SocketIOServer;
  private logger: Logger;
  private orchestrator: Orchestrator;
  private constellationState: ConstellationState;
  private config: APIServerConfig;

  constructor(orchestrator: Orchestrator, config: APIServerConfig) {
    this.orchestrator = orchestrator;
    this.config = config;
    this.logger = createLogger({ name: 'APIServer', level: config.env === 'production' ? 'info' : 'debug' });

    this.app = express();
    this.server = createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] },
      transports: ['websocket', 'polling'],
    });

    this.constellationState = {
      timestamp: Date.now(),
      satellites: [],
      topology: { edges: [] },
      routing: {},
    };

    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Security
    this.app.use(helmet());

    // CORS
    this.app.use(
      cors({
        origin: this.config.env === 'production' ? process.env.ALLOWED_ORIGINS?.split(',') : '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        credentials: true,
      })
    );

    // Logging
    this.app.use(morgan(this.config.env === 'production' ? 'combined' : 'dev'));

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ limit: '10mb', extended: true }));

    // Request context
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      req.context = {
        requestId: uuidv4(),
        timestamp: Date.now(),
        userId: req.headers['x-user-id'] as string,
      };

      res.setHeader('X-Request-ID', req.context.requestId);
      res.setHeader('X-Response-Time', `${Date.now() - req.context.timestamp}ms`);

      this.logger.debug({ requestId: req.context.requestId, method: req.method, path: req.path }, 'Incoming request');
      next();
    });

    // Request timeout
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      req.setTimeout(30000);
      next();
    });
  }

  private setupRoutes(): void {
    const apiPrefix = '/api/v1';

    // Health check
    this.app.use(`${apiPrefix}/health`, healthRoutes(this.logger));

    // Satellite management
    this.app.use(`${apiPrefix}/satellites`, satelliteRoutes(this.orchestrator, this.logger));

    // Task management
    this.app.use(`${apiPrefix}/tasks`, taskRoutes(this.orchestrator, this.logger));

    // Telemetry
    this.app.use(`${apiPrefix}/telemetry`, telemetryRoutes(this.orchestrator, this.logger));

    // Orchestration
    this.app.use(`${apiPrefix}/orchestration`, orchestrationRoutes(this.orchestrator, this.logger));

    // Root endpoint
    this.app.get('/', (req: Request, res: Response) => {
      res.json({
        name: 'OrbitalMind Control Plane API',
        version: '1.0.0',
        status: 'operational',
        timestamp: Date.now(),
      });
    });

    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not Found',
        path: req.path,
        method: req.method,
      });
    });
  }

  private setupWebSocket(): void {
    this.io.on('connection', socket => {
      this.logger.info({ socketId: socket.id }, 'WebSocket client connected');

      socket.on('subscribe', (channel: string) => {
        socket.join(channel);
        this.logger.debug({ socketId: socket.id, channel }, 'Client subscribed to channel');
      });

      socket.on('unsubscribe', (channel: string) => {
        socket.leave(channel);
        this.logger.debug({ socketId: socket.id, channel }, 'Client unsubscribed from channel');
      });

      socket.on('disconnect', () => {
        this.logger.info({ socketId: socket.id }, 'WebSocket client disconnected');
      });
    });
  }

  private setupErrorHandling(): void {
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      this.logger.error(
        {
          requestId: req.context.requestId,
          error: err.message,
          stack: err.stack,
          path: req.path,
        },
        'Unhandled error'
      );

      res.status(500).json({
        error: 'Internal Server Error',
        message: this.config.env === 'production' ? 'An error occurred' : err.message,
        requestId: req.context.requestId,
      });
    });
  }

  public async start(): Promise<void> {
    return new Promise(resolve => {
      this.server.listen(this.config.port, this.config.host, () => {
        this.logger.info(
          { port: this.config.port, host: this.config.host, env: this.config.env },
          'API server started'
        );
        resolve();
      });
    });
  }

  public async stop(): Promise<void> {
    return new Promise(resolve => {
      this.io.close();
      this.server.close(() => {
        this.logger.info('API server stopped');
        resolve();
      });
    });
  }

  public getApp(): Express {
    return this.app;
  }

  public getIO(): SocketIOServer {
    return this.io;
  }

  public broadcastUpdate(channel: string, data: unknown): void {
    this.io.to(channel).emit('update', {
      channel,
      data,
      timestamp: Date.now(),
    });
  }
}
