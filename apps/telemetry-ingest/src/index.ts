import { createLogger } from 'pino';
import { DatabaseService } from '@orbitalmind/database';
import { ConstellationState } from '@orbitalmind/shared';
import express, { Request, Response } from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

const logger = createLogger({ name: 'TelemetryIngest', level: process.env.LOG_LEVEL || 'info' });

interface TelemetryBatch {
  timestamp: number;
  satellites: Array<{
    id: string;
    thermal: {
      junctionTemperature: number;
      powerDissipation: number;
      ambientTemperature: number;
    };
    radiation: {
      seuRate24h: number;
      lastEvent: number;
    };
    power: {
      batteryLevel: number;
      solarInput: number;
    };
  }>;
}

export class TelemetryIngestService {
  private app: express.Express;
  private server: ReturnType<typeof createServer>;
  private io: SocketIOServer;
  private db: DatabaseService;
  private metricsBuffer: Map<string, TelemetryBatch> = new Map();
  private flushInterval: NodeJS.Timeout | null = null;
  private constellationId: string = '';

  constructor(db: DatabaseService) {
    this.db = db;
    this.app = express();
    this.server = createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: { origin: '*' },
      transports: ['websocket', 'polling'],
    });

    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
    this.setupPeriodicFlush();
  }

  private setupMiddleware(): void {
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ limit: '50mb', extended: true }));

    this.app.use((req: Request, res: Response, next) => {
      res.setHeader('Content-Type', 'application/json');
      next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'operational',
        timestamp: Date.now(),
        bufferedBatches: this.metricsBuffer.size,
      });
    });

    // Receive telemetry batch
    this.app.post('/api/v1/telemetry/batch', async (req: Request, res: Response) => {
      try {
        const batch: TelemetryBatch = req.body;

        if (!batch.satellites || batch.satellites.length === 0) {
          return res.status(400).json({ error: 'No satellites in batch' });
        }

        // Store in buffer for batch processing
        const batchId = `batch-${Date.now()}`;
        this.metricsBuffer.set(batchId, batch);

        // Broadcast to WebSocket clients immediately
        this.broadcastMetrics(batch);

        logger.debug(
          { batchId, satelliteCount: batch.satellites.length, timestamp: batch.timestamp },
          'Telemetry batch received'
        );

        res.status(202).json({
          status: 'accepted',
          batchId,
          satelliteCount: batch.satellites.length,
        });
      } catch (error) {
        logger.error({ error }, 'Failed to process telemetry batch');
        res.status(500).json({ error: 'Failed to process batch' });
      }
    });

    // Receive individual satellite telemetry
    this.app.post('/api/v1/telemetry/satellite/:id', async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const { thermal, radiation, power } = req.body;

        // Save thermal data
        if (thermal) {
          await this.db.saveThermalTelemetry({
            time: new Date(),
            satelliteId: id,
            junctionTemperature: thermal.junctionTemperature,
            powerDissipation: thermal.powerDissipation,
            ambientTemperature: thermal.ambientTemperature,
            status: thermal.status || 'active',
          });
        }

        // Save radiation data
        if (radiation) {
          const repo = this.db.getRadiationTelemetryRepository();
          await repo.save({
            time: new Date(),
            satelliteId: id,
            seuRate24h: radiation.seuRate24h,
            seuCount: radiation.seuCount || 0,
            lastEvent: radiation.lastEvent ? new Date(radiation.lastEvent) : undefined,
          });
        }

        // Save power data
        if (power) {
          await this.db.savePowerTelemetry({
            time: new Date(),
            satelliteId: id,
            batteryLevel: power.batteryLevel,
            solarInput: power.solarInput,
            powerDraw: power.powerDraw || 0,
          });
        }

        logger.debug({ satelliteId: id, timestamp: Date.now() }, 'Satellite telemetry received');

        res.status(201).json({
          status: 'recorded',
          satelliteId: id,
          timestamp: Date.now(),
        });
      } catch (error) {
        logger.error({ error }, 'Failed to save satellite telemetry');
        res.status(500).json({ error: 'Failed to save telemetry' });
      }
    });

    // Query telemetry
    this.app.get('/api/v1/telemetry/satellite/:id/range', async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const { startTime, endTime } = req.query;

        if (!startTime || !endTime) {
          return res.status(400).json({ error: 'startTime and endTime required' });
        }

        const start = new Date(startTime as string);
        const end = new Date(endTime as string);

        const data = await this.db.getThermalTelemetryRange(id, start, end);

        res.json({
          satelliteId: id,
          startTime: start,
          endTime: end,
          count: data.length,
          data,
        });
      } catch (error) {
        logger.error({ error }, 'Failed to query telemetry');
        res.status(500).json({ error: 'Failed to query telemetry' });
      }
    });

    // Get metrics summary
    this.app.get('/api/v1/telemetry/summary/:constellationId', async (req: Request, res: Response) => {
      try {
        const { constellationId } = req.params;

        const stats = await this.db.getThermalAggregates(constellationId);

        res.json({
          constellationId,
          timestamp: Date.now(),
          thermalMetrics: {
            averageTemp: stats.avgTemp,
            maxTemp: stats.maxTemp,
            minTemp: stats.minTemp,
            sampleCount: stats.count,
          },
        });
      } catch (error) {
        logger.error({ error }, 'Failed to get summary');
        res.status(500).json({ error: 'Failed to get summary' });
      }
    });
  }

  private setupWebSocket(): void {
    this.io.on('connection', socket => {
      logger.debug({ socketId: socket.id }, 'Telemetry client connected');

      socket.on('subscribe', (channel: string) => {
        socket.join(channel);
        logger.debug({ socketId: socket.id, channel }, 'Subscribed to channel');
      });

      socket.on('disconnect', () => {
        logger.debug({ socketId: socket.id }, 'Telemetry client disconnected');
      });
    });
  }

  private setupPeriodicFlush(): void {
    // Flush metrics to database every 10 seconds
    this.flushInterval = setInterval(() => {
      this.flushMetrics();
    }, 10000);
  }

  private async flushMetrics(): Promise<void> {
    try {
      if (this.metricsBuffer.size === 0) return;

      const entries = Array.from(this.metricsBuffer.entries());
      let thermalCount = 0;

      for (const [batchId, batch] of entries) {
        const telemetryData = batch.satellites.map(sat => ({
          time: new Date(batch.timestamp),
          satelliteId: sat.id,
          junctionTemperature: sat.thermal.junctionTemperature,
          powerDissipation: sat.thermal.powerDissipation,
          ambientTemperature: sat.thermal.ambientTemperature,
          status: 'active',
        }));

        await this.db.saveBulkThermalTelemetry(telemetryData);
        thermalCount += telemetryData.length;

        this.metricsBuffer.delete(batchId);
      }

      logger.info({ telemetryCount: thermalCount, batchCount: entries.length }, 'Metrics flushed to database');
    } catch (error) {
      logger.error({ error }, 'Failed to flush metrics');
    }
  }

  private broadcastMetrics(batch: TelemetryBatch): void {
    // Broadcast aggregated metrics to subscribers
    const avgTemp = batch.satellites.reduce((sum, s) => sum + s.thermal.junctionTemperature, 0) / batch.satellites.length;
    const maxTemp = Math.max(...batch.satellites.map(s => s.thermal.junctionTemperature));
    const totalSEU = batch.satellites.reduce((sum, s) => sum + s.radiation.seuRate24h, 0);

    this.io.emit('metrics-update', {
      timestamp: batch.timestamp,
      satelliteCount: batch.satellites.length,
      avgTemperature: avgTemp,
      maxTemperature: maxTemp,
      totalSEUEvents: totalSEU,
    });
  }

  async start(port: number = 8001): Promise<void> {
    try {
      await this.db.initialize();

      this.server.listen(port, () => {
        logger.info({ port }, 'Telemetry ingest service started');
      });

      // Graceful shutdown
      process.on('SIGTERM', () => this.shutdown());
      process.on('SIGINT', () => this.shutdown());
    } catch (error) {
      logger.error({ error }, 'Failed to start service');
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down telemetry ingest service');

    // Flush remaining metrics
    await this.flushMetrics();

    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }

    this.io.close();
    this.server.close();

    await this.db.disconnect();

    process.exit(0);
  }
}

// Main execution
async function main(): Promise<void> {
  try {
    const db = new DatabaseService({
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432', 10),
      username: process.env.DATABASE_USER || 'orbitalmind',
      password: process.env.DATABASE_PASSWORD || 'orbitalmind_dev',
      database: process.env.DATABASE_NAME || 'orbitalmind',
      ssl: process.env.DATABASE_SSL === 'true',
      maxPoolSize: parseInt(process.env.DATABASE_MAX_POOL_SIZE || '20', 10),
    });

    const service = new TelemetryIngestService(db);
    await service.start(parseInt(process.env.TELEMETRY_PORT || '8001', 10));
  } catch (error) {
    logger.error({ error }, 'Fatal error');
    process.exit(1);
  }
}

main();
