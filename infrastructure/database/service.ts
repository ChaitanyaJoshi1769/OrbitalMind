import { DataSource, Repository } from 'typeorm';
import { createLogger } from 'pino';
import { Satellite, Constellation, ThermalTelemetry, RadiationTelemetry, PowerTelemetry, InferenceTask, NetworkLink, Anomaly, SystemEvent } from './entities';

const logger = createLogger({ name: 'DatabaseService' });

export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  ssl?: boolean;
  poolSize?: number;
  maxPoolSize?: number;
  idleTimeoutMs?: number;
}

export class DatabaseService {
  private dataSource: DataSource | null = null;
  private config: DatabaseConfig;

  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    try {
      this.dataSource = new DataSource({
        type: 'postgres',
        host: this.config.host,
        port: this.config.port,
        username: this.config.username,
        password: this.config.password,
        database: this.config.database,
        entities: [Satellite, Constellation, ThermalTelemetry, RadiationTelemetry, PowerTelemetry, InferenceTask, NetworkLink, Anomaly, SystemEvent],
        migrations: ['infrastructure/database/migrations/*.ts'],
        synchronize: false,
        logging: process.env.LOG_LEVEL === 'debug',
        ssl: this.config.ssl ? { rejectUnauthorized: false } : undefined,
        extra: {
          max: this.config.maxPoolSize || 10,
          idleTimeoutMillis: this.config.idleTimeoutMs || 30000,
          connectionTimeoutMillis: 10000,
        },
      });

      await this.dataSource.initialize();
      logger.info({ host: this.config.host, database: this.config.database }, 'Database connected');

      // Run migrations
      await this.dataSource.runMigrations();
      logger.info('Migrations completed');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize database');
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.dataSource && this.dataSource.isInitialized) {
      await this.dataSource.destroy();
      logger.info('Database disconnected');
    }
  }

  // Repositories
  getSatelliteRepository(): Repository<Satellite> {
    if (!this.dataSource) throw new Error('DataSource not initialized');
    return this.dataSource.getRepository(Satellite);
  }

  getConstellationRepository(): Repository<Constellation> {
    if (!this.dataSource) throw new Error('DataSource not initialized');
    return this.dataSource.getRepository(Constellation);
  }

  getThermalTelemetryRepository(): Repository<ThermalTelemetry> {
    if (!this.dataSource) throw new Error('DataSource not initialized');
    return this.dataSource.getRepository(ThermalTelemetry);
  }

  getRadiationTelemetryRepository(): Repository<RadiationTelemetry> {
    if (!this.dataSource) throw new Error('DataSource not initialized');
    return this.dataSource.getRepository(RadiationTelemetry);
  }

  getPowerTelemetryRepository(): Repository<PowerTelemetry> {
    if (!this.dataSource) throw new Error('DataSource not initialized');
    return this.dataSource.getRepository(PowerTelemetry);
  }

  getInferenceTaskRepository(): Repository<InferenceTask> {
    if (!this.dataSource) throw new Error('DataSource not initialized');
    return this.dataSource.getRepository(InferenceTask);
  }

  getNetworkLinkRepository(): Repository<NetworkLink> {
    if (!this.dataSource) throw new Error('DataSource not initialized');
    return this.dataSource.getRepository(NetworkLink);
  }

  getAnomalyRepository(): Repository<Anomaly> {
    if (!this.dataSource) throw new Error('DataSource not initialized');
    return this.dataSource.getRepository(Anomaly);
  }

  getSystemEventRepository(): Repository<SystemEvent> {
    if (!this.dataSource) throw new Error('DataSource not initialized');
    return this.dataSource.getRepository(SystemEvent);
  }

  // Telemetry operations
  async saveThermalTelemetry(data: Omit<ThermalTelemetry, 'id'>): Promise<ThermalTelemetry> {
    const repo = this.getThermalTelemetryRepository();
    const telemetry = repo.create(data);
    return repo.save(telemetry);
  }

  async saveBulkThermalTelemetry(data: Omit<ThermalTelemetry, 'id'>[]): Promise<ThermalTelemetry[]> {
    const repo = this.getThermalTelemetryRepository();
    const telemetries = repo.create(data);
    return repo.save(telemetries);
  }

  async getThermalTelemetryRange(satelliteId: string, startTime: Date, endTime: Date): Promise<ThermalTelemetry[]> {
    const repo = this.getThermalTelemetryRepository();
    return repo.find({
      where: {
        satelliteId: satelliteId as any,
        time: { between: [startTime, endTime] } as any,
      },
      order: { time: 'DESC' },
      take: 10000,
    });
  }

  async getLatestThermalTelemetry(satelliteId: string, limit: number = 100): Promise<ThermalTelemetry[]> {
    const repo = this.getThermalTelemetryRepository();
    return repo.find({
      where: { satelliteId: satelliteId as any },
      order: { time: 'DESC' },
      take: limit,
    });
  }

  async getThermalAggregates(constellationId: string, timeWindowMs: number = 3600000): Promise<{
    avgTemp: number;
    maxTemp: number;
    minTemp: number;
    count: number;
  }> {
    if (!this.dataSource) throw new Error('DataSource not initialized');

    const result = await this.dataSource.query(
      `
      SELECT
        AVG(junction_temperature) as avg_temp,
        MAX(junction_temperature) as max_temp,
        MIN(junction_temperature) as min_temp,
        COUNT(*) as count
      FROM thermal_telemetry t
      JOIN satellites s ON t.satellite_id = s.id
      WHERE s.constellation_id = $1
      AND t.time > NOW() - INTERVAL '1 hour'
      `,
      [constellationId]
    );

    return {
      avgTemp: result[0].avg_temp || 0,
      maxTemp: result[0].max_temp || 0,
      minTemp: result[0].min_temp || 0,
      count: parseInt(result[0].count, 10) || 0,
    };
  }

  // Task operations
  async createTask(data: Omit<InferenceTask, 'id'>): Promise<InferenceTask> {
    const repo = this.getInferenceTaskRepository();
    const task = repo.create(data);
    return repo.save(task);
  }

  async updateTaskStatus(taskId: string, status: string, updates?: Partial<InferenceTask>): Promise<void> {
    const repo = this.getInferenceTaskRepository();
    await repo.update({ taskId }, { status, ...updates });
  }

  async getTask(taskId: string): Promise<InferenceTask | null> {
    const repo = this.getInferenceTaskRepository();
    return repo.findOne({ where: { taskId } });
  }

  async listTasks(status?: string, limit: number = 100, offset: number = 0): Promise<{ tasks: InferenceTask[]; total: number }> {
    const repo = this.getInferenceTaskRepository();
    const query = repo.createQueryBuilder('task');

    if (status) {
      query.where('task.status = :status', { status });
    }

    const [tasks, total] = await query.skip(offset).take(limit).orderBy('task.created_at', 'DESC').getManyAndCount();

    return { tasks, total };
  }

  // Anomaly operations
  async logAnomaly(data: Omit<Anomaly, 'id'>): Promise<Anomaly> {
    const repo = this.getAnomalyRepository();
    const anomaly = repo.create(data);
    return repo.save(anomaly);
  }

  async getActiveAnomalies(constellationId?: string): Promise<Anomaly[]> {
    const repo = this.getAnomalyRepository();
    const query = repo.createQueryBuilder('anomaly');

    if (constellationId) {
      query
        .innerJoin('satellites', 's', 's.id = anomaly.satellite_id')
        .where('s.constellation_id = :constellationId', { constellationId })
        .andWhere('anomaly.resolved_at IS NULL');
    } else {
      query.where('anomaly.resolved_at IS NULL');
    }

    return query.orderBy('anomaly.detected_at', 'DESC').getMany();
  }

  // Network operations
  async upsertNetworkLink(data: Partial<NetworkLink> & { sourceId: string; destinationId: string }): Promise<NetworkLink> {
    const repo = this.getNetworkLinkRepository();
    const existing = await repo.findOne({
      where: { sourceId: data.sourceId as any, destinationId: data.destinationId as any },
    });

    if (existing) {
      Object.assign(existing, data);
      return repo.save(existing);
    }

    const link = repo.create(data as NetworkLink);
    return repo.save(link);
  }

  async getNetworkTopology(constellationId: string): Promise<NetworkLink[]> {
    if (!this.dataSource) throw new Error('DataSource not initialized');

    return this.dataSource.query(
      `
      SELECT DISTINCT nl.*
      FROM network_topology nl
      JOIN satellites s_src ON nl.source_id = s_src.id
      JOIN satellites s_dst ON nl.destination_id = s_dst.id
      WHERE s_src.constellation_id = $1
      AND s_dst.constellation_id = $1
      `,
      [constellationId]
    );
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.dataSource) return false;
      await this.dataSource.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}
