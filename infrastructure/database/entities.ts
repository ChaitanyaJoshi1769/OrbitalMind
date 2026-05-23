import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';

@Entity('satellites')
@Index(['satellite_id'], { unique: true })
@Index(['constellation_id'])
@Index(['status'])
export class Satellite {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  satelliteId!: string;

  @Column({ type: 'uuid' })
  constellationId!: string;

  @Column({ type: 'varchar', length: 50, default: 'healthy' })
  status!: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @OneToMany(() => ThermalTelemetry, telemetry => telemetry.satellite)
  thermalData?: ThermalTelemetry[];

  @OneToMany(() => RadiationTelemetry, telemetry => telemetry.satellite)
  radiationData?: RadiationTelemetry[];

  @OneToMany(() => PowerTelemetry, telemetry => telemetry.satellite)
  powerData?: PowerTelemetry[];
}

@Entity('constellations')
@Index(['name'])
@Index(['status'])
export class Constellation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'int', default: 0 })
  satelliteCount!: number;

  @Column({ type: 'varchar', length: 50, default: 'operational' })
  status!: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}

@Entity('thermal_telemetry')
@Index(['satellite_id', 'time'], { where: `"time" > current_timestamp - interval '24 hours'` })
@Index(['junction_temperature'], { where: '"junction_temperature" > 75' })
export class ThermalTelemetry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'timestamp with time zone' })
  time!: Date;

  @Column({ type: 'uuid' })
  satelliteId!: string;

  @Column({ type: 'float' })
  junctionTemperature!: number;

  @Column({ type: 'float' })
  powerDissipation!: number;

  @Column({ type: 'float' })
  ambientTemperature!: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  status?: string;

  @ManyToOne(() => Satellite, satellite => satellite.thermalData, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'satellite_id' })
  satellite?: Satellite;
}

@Entity('radiation_telemetry')
@Index(['satellite_id', 'time'])
@Index(['seu_rate_24h'], { where: '"seu_rate_24h" > 100' })
export class RadiationTelemetry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'timestamp with time zone' })
  time!: Date;

  @Column({ type: 'uuid' })
  satelliteId!: string;

  @Column({ type: 'int' })
  seuRate24h!: number;

  @Column({ type: 'int', default: 0 })
  seuCount!: number;

  @Column({ type: 'timestamp with time zone', nullable: true })
  lastEvent?: Date;

  @ManyToOne(() => Satellite, satellite => satellite.radiationData, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'satellite_id' })
  satellite?: Satellite;
}

@Entity('power_telemetry')
@Index(['satellite_id', 'time'])
@Index(['battery_level'], { where: '"battery_level" < 20' })
export class PowerTelemetry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'timestamp with time zone' })
  time!: Date;

  @Column({ type: 'uuid' })
  satelliteId!: string;

  @Column({ type: 'float' })
  batteryLevel!: number;

  @Column({ type: 'float' })
  solarInput!: number;

  @Column({ type: 'float', default: 0 })
  powerDraw!: number;

  @ManyToOne(() => Satellite, satellite => satellite.powerData, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'satellite_id' })
  satellite?: Satellite;
}

@Entity('inference_tasks')
@Index(['status'])
@Index(['satellite_id'])
@Index(['model_id'])
@Index(['created_at'])
export class InferenceTask {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  taskId!: string;

  @Column({ type: 'uuid', nullable: true })
  satelliteId?: string;

  @Column({ type: 'varchar', length: 255 })
  modelId!: string;

  @Column({ type: 'varchar', length: 50 })
  priority!: string;

  @Column({ type: 'varchar', length: 50, default: 'queued' })
  status!: string;

  @Column({ type: 'bytea', nullable: true })
  inputData?: Buffer;

  @Column({ type: 'bytea', nullable: true })
  outputData?: Buffer;

  @Column({ type: 'int', nullable: true })
  timeoutMs?: number;

  @Column({ type: 'boolean', default: false })
  enableRedundancy!: boolean;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  startedAt?: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  completedAt?: Date;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;
}

@Entity('network_topology')
@Index(['source_id'])
@Index(['destination_id'])
@Index(['quality'])
export class NetworkLink {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  sourceId!: string;

  @Column({ type: 'uuid' })
  destinationId!: string;

  @Column({ type: 'float' })
  quality!: number;

  @Column({ type: 'float', nullable: true })
  latencyMs?: number;

  @Column({ type: 'float', nullable: true })
  bandwidthMbps?: number;

  @Column({ type: 'float', nullable: true })
  reliability?: number;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  lastUpdate!: Date;
}

@Entity('anomalies')
@Index(['satellite_id'])
@Index(['anomaly_type'])
@Index(['detected_at'])
export class Anomaly {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  satelliteId?: string;

  @Column({ type: 'varchar', length: 100 })
  anomalyType!: string;

  @Column({ type: 'varchar', length: 50 })
  severity!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'float', nullable: true })
  value?: number;

  @Column({ type: 'float', nullable: true })
  threshold?: number;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  detectedAt!: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  resolvedAt?: Date;
}

@Entity('system_events')
@Index(['event_type'])
@Index(['created_at'])
export class SystemEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  eventType!: string;

  @Column({ type: 'varchar', length: 50 })
  severity!: string;

  @Column({ type: 'text', nullable: true })
  message?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  source?: string;

  @Column({ type: 'jsonb', nullable: true })
  data?: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;
}
