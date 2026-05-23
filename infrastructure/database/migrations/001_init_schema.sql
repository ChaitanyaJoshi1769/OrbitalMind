-- OrbitalMind Database Schema
-- PostgreSQL with TimescaleDB extension for time-series data

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Satellites table
CREATE TABLE satellites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  satellite_id VARCHAR(255) UNIQUE NOT NULL,
  constellation_id UUID NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'healthy',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB,
  INDEX idx_constellation (constellation_id),
  INDEX idx_status (status),
  INDEX idx_satellite_id (satellite_id)
);

-- Constellations table
CREATE TABLE constellations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  satellite_count INT DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'operational',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_name (name),
  INDEX idx_status (status)
);

-- Thermal telemetry (time-series)
CREATE TABLE thermal_telemetry (
  time TIMESTAMP WITH TIME ZONE NOT NULL,
  satellite_id UUID NOT NULL REFERENCES satellites(id) ON DELETE CASCADE,
  junction_temperature FLOAT NOT NULL,
  power_dissipation FLOAT NOT NULL,
  ambient_temperature FLOAT NOT NULL,
  status VARCHAR(50),
  FOREIGN KEY (satellite_id) REFERENCES satellites(id) ON DELETE CASCADE
);

-- Convert to hypertable for time-series optimization
SELECT create_hypertable('thermal_telemetry', 'time', if_not_exists => TRUE);
CREATE INDEX idx_thermal_satellite_time ON thermal_telemetry (satellite_id, time DESC);
CREATE INDEX idx_thermal_temp ON thermal_telemetry (junction_temperature) WHERE junction_temperature > 75;

-- Radiation telemetry (time-series)
CREATE TABLE radiation_telemetry (
  time TIMESTAMP WITH TIME ZONE NOT NULL,
  satellite_id UUID NOT NULL REFERENCES satellites(id) ON DELETE CASCADE,
  seu_rate_24h INT NOT NULL,
  seu_count INT NOT NULL,
  last_event TIMESTAMP WITH TIME ZONE,
  FOREIGN KEY (satellite_id) REFERENCES satellites(id) ON DELETE CASCADE
);

-- Convert to hypertable
SELECT create_hypertable('radiation_telemetry', 'time', if_not_exists => TRUE);
CREATE INDEX idx_radiation_satellite_time ON radiation_telemetry (satellite_id, time DESC);
CREATE INDEX idx_radiation_seu ON radiation_telemetry (seu_rate_24h) WHERE seu_rate_24h > 100;

-- Power telemetry (time-series)
CREATE TABLE power_telemetry (
  time TIMESTAMP WITH TIME ZONE NOT NULL,
  satellite_id UUID NOT NULL REFERENCES satellites(id) ON DELETE CASCADE,
  battery_level FLOAT NOT NULL,
  solar_input FLOAT NOT NULL,
  power_draw FLOAT NOT NULL,
  FOREIGN KEY (satellite_id) REFERENCES satellites(id) ON DELETE CASCADE
);

-- Convert to hypertable
SELECT create_hypertable('power_telemetry', 'time', if_not_exists => TRUE);
CREATE INDEX idx_power_satellite_time ON power_telemetry (satellite_id, time DESC);
CREATE INDEX idx_power_battery ON power_telemetry (battery_level) WHERE battery_level < 20;

-- Inference tasks table
CREATE TABLE inference_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id VARCHAR(255) UNIQUE NOT NULL,
  satellite_id UUID REFERENCES satellites(id) ON DELETE SET NULL,
  model_id VARCHAR(255) NOT NULL,
  priority VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'queued',
  input_data BYTEA,
  output_data BYTEA,
  timeout_ms INT,
  enable_redundancy BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  INDEX idx_status (status),
  INDEX idx_satellite_id (satellite_id),
  INDEX idx_model_id (model_id),
  INDEX idx_created (created_at DESC)
);

-- Network topology table
CREATE TABLE network_topology (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES satellites(id) ON DELETE CASCADE,
  destination_id UUID NOT NULL REFERENCES satellites(id) ON DELETE CASCADE,
  quality FLOAT NOT NULL,
  latency_ms FLOAT,
  bandwidth_mbps FLOAT,
  reliability FLOAT,
  last_update TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (source_id, destination_id),
  INDEX idx_source (source_id),
  INDEX idx_destination (destination_id),
  INDEX idx_quality (quality)
);

-- Routing table
CREATE TABLE routing_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES satellites(id) ON DELETE CASCADE,
  destination_id UUID NOT NULL REFERENCES satellites(id) ON DELETE CASCADE,
  next_hop_id UUID REFERENCES satellites(id) ON DELETE SET NULL,
  link_quality FLOAT NOT NULL,
  hop_count INT NOT NULL,
  last_update TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_source_dest (source_id, destination_id),
  INDEX idx_source (source_id)
);

-- Anomalies table
CREATE TABLE anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  satellite_id UUID REFERENCES satellites(id) ON DELETE CASCADE,
  anomaly_type VARCHAR(100) NOT NULL,
  severity VARCHAR(50) NOT NULL,
  description TEXT,
  value FLOAT,
  threshold FLOAT,
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP WITH TIME ZONE,
  INDEX idx_satellite (satellite_id),
  INDEX idx_type (anomaly_type),
  INDEX idx_detected (detected_at DESC)
);

-- Checkpoints for fault recovery
CREATE TABLE checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES inference_tasks(id) ON DELETE CASCADE,
  satellite_id UUID NOT NULL REFERENCES satellites(id) ON DELETE CASCADE,
  checkpoint_data BYTEA NOT NULL,
  state JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_task (task_id),
  INDEX idx_satellite (satellite_id),
  INDEX idx_created (created_at DESC)
);

-- System events log
CREATE TABLE system_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100) NOT NULL,
  severity VARCHAR(50) NOT NULL,
  message TEXT,
  source VARCHAR(255),
  data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_type (event_type),
  INDEX idx_created (created_at DESC)
);

-- Metrics snapshots (hourly aggregates)
CREATE TABLE metrics_snapshots (
  time TIMESTAMP WITH TIME ZONE NOT NULL,
  constellation_id UUID NOT NULL REFERENCES constellations(id) ON DELETE CASCADE,
  avg_temperature FLOAT,
  max_temperature FLOAT,
  min_temperature FLOAT,
  avg_battery FLOAT,
  min_battery FLOAT,
  total_seu FLOAT,
  network_links INT,
  healthy_links INT,
  tasks_completed INT,
  tasks_failed INT
);

-- Convert metrics to hypertable
SELECT create_hypertable('metrics_snapshots', 'time', if_not_exists => TRUE);
CREATE INDEX idx_metrics_constellation ON metrics_snapshots (constellation_id, time DESC);

-- Create retention policy for old telemetry (30 days)
SELECT add_retention_policy('thermal_telemetry', INTERVAL '30 days', if_not_exists => TRUE);
SELECT add_retention_policy('radiation_telemetry', INTERVAL '30 days', if_not_exists => TRUE);
SELECT add_retention_policy('power_telemetry', INTERVAL '30 days', if_not_exists => TRUE);
SELECT add_retention_policy('metrics_snapshots', INTERVAL '90 days', if_not_exists => TRUE);

-- Create continuous aggregate for hourly thermal stats
CREATE MATERIALIZED VIEW thermal_stats_1h
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', time) AS bucket,
  satellite_id,
  AVG(junction_temperature) AS avg_temp,
  MAX(junction_temperature) AS max_temp,
  MIN(junction_temperature) AS min_temp,
  COUNT(*) AS sample_count
FROM thermal_telemetry
GROUP BY bucket, satellite_id
WITH DATA;

-- Create policy for continuous aggregate refresh
SELECT add_continuous_aggregate_policy('thermal_stats_1h', start_offset => INTERVAL '2 hours', end_offset => INTERVAL '1 minute', schedule_interval => INTERVAL '1 minute', if_not_exists => TRUE);
