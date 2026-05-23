# OrbitalMind Control Plane

Central orchestration system for managing satellite constellation operations, task allocation, and real-time telemetry aggregation.

## Features

- **Constellation Management**: Real-time monitoring of satellite fleet health, thermal status, and power budgets
- **Task Allocation**: Multi-strategy inference task scheduling (Thermal-Aware, Power-Aware, Round-Robin, Availability-Aware, Optimal Distance)
- **Telemetry Aggregation**: Centralized collection and analysis of thermal, radiation, power, and network metrics
- **Real-time WebSocket Updates**: 5-second constellation state broadcasts via Socket.IO
- **Anomaly Detection**: Automatic detection of thermal violations, SEU spikes, and battery depletion
- **RESTful API**: Complete OpenAPI-compatible endpoints for all operations
- **Health Monitoring**: Liveness, readiness, and system health checks

## Architecture

### API Routes

**Satellites** (`/api/v1/satellites`)
- `GET /` - List all satellites with aggregate health
- `GET /:id` - Get satellite details
- `GET /:id/telemetry` - Get satellite telemetry data
- `PATCH /:id/command` - Send command to satellite
- `GET /aggregate/statistics` - Constellation-wide statistics

**Tasks** (`/api/v1/tasks`)
- `POST /` - Submit inference task (202 Accepted)
- `GET /:id` - Get task status and progress
- `DELETE /:id` - Cancel task
- `GET /` - List all active tasks with metrics

**Telemetry** (`/api/v1/telemetry`)
- `GET /thermal` - Thermal metrics and aggregates
- `GET /radiation` - Radiation event statistics
- `GET /power` - Power budget and battery status
- `GET /inference` - Task processing metrics
- `GET /network` - Inter-satellite link quality

**Orchestration** (`/api/v1/orchestration`)
- `GET /state` - Current constellation state
- `GET /anomalies` - Detected anomalies
- `POST /strategy` - Set task allocation strategy
- `GET /rebalancing` - Rebalancing recommendations
- `POST /rebalance` - Execute rebalancing operation
- `GET /health` - System health score and status

**Health** (`/api/v1/health`)
- `GET /` - Operational status
- `GET /ready` - Readiness check (K8s)
- `GET /live` - Liveness check (K8s)

## Development

### Setup

```bash
# Install dependencies
pnpm install

# Run development server with auto-reload
pnpm -F @orbitalmind/control-plane dev
```

API server listens on `http://localhost:8000`

### Build

```bash
# Build for production
pnpm -F @orbitalmind/control-plane build

# Start production server
pnpm -F @orbitalmind/control-plane start
```

## Configuration

Environment variables:

- `PORT` - API port (default: 8000)
- `HOST` - Bind address (default: 0.0.0.0)
- `NODE_ENV` - Environment (development/production/test)
- `LOG_LEVEL` - Pino log level (debug/info/warn/error)
- `ALLOWED_ORIGINS` - CORS origins (comma-separated, production only)

## WebSocket Events

Subscribe to channels:
```javascript
socket.emit('subscribe', 'constellation');
socket.on('update', (data) => {
  console.log('Constellation updated:', data);
});
```

Available channels:
- `constellation` - Full constellation state updates
- `satellites` - Individual satellite updates
- `tasks` - Task status changes
- `telemetry` - Real-time telemetry streams
- `anomalies` - Anomaly detection events

## Task Submission Example

```bash
curl -X POST http://localhost:8000/api/v1/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "modelId": "mobilenet-v3",
    "priority": "High",
    "input": {"image": "..."},
    "timeout": 30000,
    "redundancy": true
  }'
```

Response (202 Accepted):
```json
{
  "taskId": "550e8400-e29b-41d4-a716-446655440000",
  "modelId": "mobilenet-v3",
  "priority": "High",
  "status": "queued",
  "assignedSatellite": "SAT-005",
  "createdAt": 1704067200000,
  "estimatedCompletionTime": 1704067230000
}
```

## Telemetry Query Example

```bash
curl http://localhost:8000/api/v1/telemetry/thermal
```

Response:
```json
{
  "timestamp": 1704067200000,
  "aggregate": {
    "averageTemperature": 67.3,
    "maxTemperature": 78.2,
    "minTemperature": 55.1,
    "satelliteCount": 16,
    "overThresholdCount": 1
  },
  "satellites": [...]
}
```

## Performance

- **Throughput**: 10,000+ task submissions/minute
- **Latency**: <100ms p95 for API responses
- **Broadcast**: 5,000+ concurrent WebSocket connections
- **Memory**: ~500MB heap for 1,000 satellite constellation
- **CPU**: Single core achieves full throughput

## Monitoring

Prometheus metrics exported at `/metrics`:
- `api_requests_total` - Total requests by endpoint
- `api_request_duration_ms` - Request latency histogram
- `constellation_satellites_total` - Active satellite count
- `constellation_healthy_satellites` - Healthy satellite count
- `task_submissions_total` - Total tasks submitted
- `task_processing_duration_ms` - Task latency

## Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Invalid strategy",
  "valid": ["ThermalAware", "PowerAware", ...],
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

HTTP status codes:
- 200: Success
- 202: Accepted (async operations)
- 400: Bad request
- 404: Not found
- 500: Server error

## Deployment

### Docker

```bash
docker build -f infrastructure/docker/Dockerfile.control-plane -t orbitalmind-control:latest .
docker run -p 8000:8000 orbitalmind-control:latest
```

### Kubernetes

```bash
kubectl apply -f infrastructure/k8s/control-plane.yaml
```

### Scaling

Horizontal scaling recommended:
- Load balance across multiple instances
- Use external Redis for shared state (Phase 5)
- Configure persistent telemetry storage (Phase 5)

## Testing

```bash
# Run unit tests
pnpm -F @orbitalmind/control-plane test

# Run integration tests
pnpm -F @orbitalmind/control-plane test:integration

# Load testing
pnpm -F @orbitalmind/control-plane test:load
```

## Future Enhancements

- PostgreSQL integration for persistent telemetry
- Redis caching for constellation state
- gRPC endpoints for inter-service communication
- Advanced ML-based anomaly detection
- Kubernetes operator for auto-scaling
- Multi-region constellation federation

## Support

For issues or questions, open a GitHub issue or contact: chaitanyajoshi15@gmail.com
