# OrbitalMind Telemetry Ingest Pipeline

Real-time metrics ingestion and storage service for satellite constellation telemetry with batch processing, streaming, and historical queries.

## Features

- **Real-time Ingestion**: Accept telemetry from satellites via HTTP and WebSocket
- **Batch Processing**: Efficient bulk insert of multiple satellite readings
- **Time-Series Storage**: PostgreSQL with TimescaleDB for optimized storage
- **WebSocket Streaming**: Push metrics to connected clients in real-time
- **Historical Queries**: Time-range queries for analysis and reporting
- **Automatic Flushing**: Periodic buffer flush for consistent latency
- **High Throughput**: 10,000+ metrics/second capacity

## API Endpoints

### Batch Ingestion

POST /api/v1/telemetry/batch
```json
{
  "timestamp": 1704067200000,
  "satellites": [
    {
      "id": "SAT-001",
      "thermal": {
        "junctionTemperature": 65.5,
        "powerDissipation": 45.2,
        "ambientTemperature": -50
      },
      "radiation": {
        "seuRate24h": 42,
        "lastEvent": 1704067190000
      },
      "power": {
        "batteryLevel": 82.5,
        "solarInput": 215.3
      }
    }
  ]
}
```

Response: 202 Accepted
```json
{
  "status": "accepted",
  "batchId": "batch-1704067200000",
  "satelliteCount": 1
}
```

### Individual Satellite Telemetry

POST /api/v1/telemetry/satellite/:id
```json
{
  "thermal": {
    "junctionTemperature": 65.5,
    "powerDissipation": 45.2,
    "ambientTemperature": -50,
    "status": "active"
  },
  "radiation": {
    "seuRate24h": 42,
    "seuCount": 2,
    "lastEvent": 1704067190000
  },
  "power": {
    "batteryLevel": 82.5,
    "solarInput": 215.3,
    "powerDraw": 35.0
  }
}
```

Response: 201 Created
```json
{
  "status": "recorded",
  "satelliteId": "SAT-001",
  "timestamp": 1704067200000
}
```

### Historical Queries

GET /api/v1/telemetry/satellite/:id/range?startTime=ISO8601&endTime=ISO8601

Response:
```json
{
  "satelliteId": "SAT-001",
  "startTime": "2026-01-01T00:00:00Z",
  "endTime": "2026-01-02T00:00:00Z",
  "count": 1440,
  "data": [
    {
      "time": "2026-01-02T00:00:00Z",
      "junctionTemperature": 67.3,
      "powerDissipation": 46.1,
      "ambientTemperature": -50
    }
  ]
}
```

### Metrics Summary

GET /api/v1/telemetry/summary/:constellationId

Response:
```json
{
  "constellationId": "constellation-001",
  "timestamp": 1704067200000,
  "thermalMetrics": {
    "averageTemp": 65.4,
    "maxTemp": 72.1,
    "minTemp": 58.9,
    "sampleCount": 16
  }
}
```

### Health Check

GET /health

Response:
```json
{
  "status": "operational",
  "timestamp": 1704067200000,
  "bufferedBatches": 3
}
```

## WebSocket Streaming

Connect to the WebSocket server to receive real-time metrics:

```javascript
const socket = io('http://localhost:8001', {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
});

socket.on('connect', () => {
  console.log('Connected to telemetry service');
});

socket.on('metrics-update', (data) => {
  console.log('Metrics:', {
    satelliteCount: data.satelliteCount,
    avgTemperature: data.avgTemperature,
    maxTemperature: data.maxTemperature,
    totalSEUEvents: data.totalSEUEvents,
  });
});

// Subscribe to specific channel
socket.emit('subscribe', 'constellation-001');
```

## Performance Characteristics

- **Throughput**: 10,000+ metrics/second
- **Latency**: <100ms from ingestion to database
- **Buffer Size**: Configurable, default 100 batches
- **Flush Interval**: 10 seconds
- **Connection Pool**: 5-20 concurrent database connections

## Deployment

### Development

```bash
# Start all services
pnpm dev

# Or just telemetry ingest
pnpm -F @orbitalmind/telemetry-ingest dev
```

### Production

```bash
# Build
pnpm -F @orbitalmind/telemetry-ingest build

# Run
TELEMETRY_PORT=8001 \
DATABASE_HOST=postgres \
DATABASE_USER=orbitalmind \
DATABASE_PASSWORD=secure_password \
pnpm -F @orbitalmind/telemetry-ingest start
```

### Docker

```bash
docker run -p 8001:8001 \
  -e DATABASE_HOST=postgres \
  -e DATABASE_USER=orbitalmind \
  -e DATABASE_PASSWORD=secure_password \
  orbitalmind/telemetry-ingest:latest
```

## Configuration

Environment variables:

```env
# Service
TELEMETRY_PORT=8001                    # Port to listen on
LOG_LEVEL=info                         # Logging level (debug/info/warn/error)

# Database
DATABASE_HOST=localhost                # PostgreSQL host
DATABASE_PORT=5432                     # PostgreSQL port
DATABASE_NAME=orbitalmind              # Database name
DATABASE_USER=orbitalmind              # Database user
DATABASE_PASSWORD=secure_password      # Database password
DATABASE_SSL=false                     # Use SSL for database
DATABASE_MAX_POOL_SIZE=20              # Maximum connection pool size

# Ingestion
FLUSH_INTERVAL_MS=10000                # Metrics buffer flush interval
MAX_BUFFER_SIZE=1000                   # Maximum batches to buffer
```

## Metrics Processing Pipeline

```
Ingestion
    ↓
WebSocket Broadcast (immediate)
    ↓
Memory Buffer
    ↓
Periodic Flush (10s)
    ↓
Database Storage
    ↓
Historical Queries
```

## Monitoring

### Key Metrics to Track

- **Ingestion Rate**: Metrics per second
- **Buffer Size**: Current queued batches
- **Flush Duration**: Time to write batch to database
- **API Latency**: Response time for ingestion endpoints
- **Database Connection Pool**: Active connections vs max

### Health Checks

```bash
# Service health
curl http://localhost:8001/health

# Database connectivity
curl http://localhost:8001/api/v1/telemetry/summary/{constellationId}
```

## Integration with Control Plane

The telemetry ingest service integrates with the control plane:

1. **Receives telemetry** from satellites via REST API
2. **Broadcasts metrics** to WebSocket clients (dashboard, monitoring)
3. **Stores historical data** for analysis and reporting
4. **Provides queries** to control plane for orchestration decisions

```typescript
// From satellite firmware
POST http://control-plane:8001/api/v1/telemetry/batch
// Batch of recent measurements

// Dashboard subscribes to updates
const socket = io('http://control-plane:8001');
socket.on('metrics-update', updateDashboard);
```

## Scaling

### Horizontal Scaling

Deploy multiple instances behind a load balancer:

```yaml
# Load balancer
upstream telemetry {
  server telemetry-1:8001;
  server telemetry-2:8001;
  server telemetry-3:8001;
}

server {
  listen 80;
  location / {
    proxy_pass http://telemetry;
  }
}
```

### Database Optimization

- Use connection pooling (PgBouncer)
- Enable TimescaleDB compression for old data
- Create retention policies for automatic cleanup
- Use continuous aggregates for metrics rollups

## Troubleshooting

### High Memory Usage

```bash
# Reduce buffer size
MAX_BUFFER_SIZE=100

# Reduce flush interval
FLUSH_INTERVAL_MS=5000
```

### Database Connection Issues

```bash
# Check connection pool status
SELECT datname, count(*) FROM pg_stat_activity GROUP BY datname;

# Monitor slow queries
SELECT query, calls, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;
```

### WebSocket Client Disconnections

- Ensure firewall allows WebSocket connections
- Check load balancer WebSocket support
- Monitor client-side logs for reconnection attempts

## Future Enhancements

- Kafka integration for event streaming
- Prometheus metrics export
- Real-time alerting based on thresholds
- Data compression for archival
- Cross-constellation federation

## Support

For questions or issues, open a GitHub issue or contact: chaitanyajoshi15@gmail.com
