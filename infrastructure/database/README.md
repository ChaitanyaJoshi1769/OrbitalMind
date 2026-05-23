# OrbitalMind Database Layer

PostgreSQL with TimescaleDB extension for high-performance time-series telemetry storage and retrieval.

## Architecture

### Components

1. PostgreSQL 14+: Primary relational database
2. TimescaleDB 2.10+: Time-series optimization extension
3. Connection Pooling: PgBouncer for connection management
4. TypeORM: Type-safe database access layer

### Schema Overview

Core Tables:
- satellites - Satellite metadata
- constellations - Constellation management
- network_topology - ISL topology
- inference_tasks - Task tracking

Time-Series Tables (Hypertables):
- thermal_telemetry - Temperature and power data
- radiation_telemetry - SEU and radiation data
- power_telemetry - Battery and solar data
- metrics_snapshots - Hourly aggregates

Supporting Tables:
- anomalies - Anomaly detection log
- system_events - System event log
- checkpoints - Fault recovery checkpoints

## Setup

### Prerequisites

Docker Compose (Recommended):
```bash
docker-compose -f infrastructure/docker/docker-compose.db.yml up -d
```

Or manual installation:
- PostgreSQL 14+
- TimescaleDB 2.10+
- pgBouncer for connection pooling

### Environment Variables

Create `.env.local`:

```
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=orbitalmind
DATABASE_USER=orbitalmind
DATABASE_PASSWORD=secure_password_here
DATABASE_SSL=false
DATABASE_POOL_SIZE=5
DATABASE_MAX_POOL_SIZE=20
DATABASE_IDLE_TIMEOUT_MS=30000
```

### Installation

1. Install dependencies
   pnpm install

2. Create database and user
   psql -U postgres
   CREATE DATABASE orbitalmind;
   CREATE USER orbitalmind WITH PASSWORD 'secure_password_here';
   GRANT ALL PRIVILEGES ON DATABASE orbitalmind TO orbitalmind;

3. Enable extensions
   psql -U orbitalmind -d orbitalmind
   CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
   CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

4. Run migrations
   pnpm run migrate

## Performance Features

- Time-series hypertables with automatic partitioning
- Continuous aggregates for hourly metrics
- Compression for 30+ day old data
- Retention policies for automatic cleanup
- Optimized indexes for anomaly detection

## Backup and Recovery

Automated daily backups:
```bash
0 2 * * * pg_dump -U orbitalmind orbitalmind | gzip > /backups/orbitalmind_YYYYMMDD.sql.gz
```

Point-in-time recovery enabled via WAL archiving.

## Monitoring

Key metrics tracked:
- Table and index sizes
- Query performance
- Cache hit ratio (target >99%)
- Connection pool utilization
- Slow queries (>1000ms)

## Security

- Role-based access control (reader/writer)
- SSL/TLS required for remote connections
- Network isolation via security groups
- Audit logging enabled

## Troubleshooting

High disk usage: Check table compression and retention policies
Slow queries: Analyze missing indexes and enable query logging
Connection issues: Verify pgBouncer pool configuration

## Support

For questions or issues, open a GitHub issue or contact: chaitanyajoshi15@gmail.com
