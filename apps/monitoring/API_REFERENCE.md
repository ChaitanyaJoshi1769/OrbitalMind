# OrbitalMind Monitoring API Reference

Complete documentation for the Monitoring API Server endpoints and client library.

## Overview

The Monitoring API Server provides REST endpoints for:
- Recording performance metrics
- Updating service health status
- Retrieving alerts and monitoring data
- Accessing real-time dashboard
- Querying service statistics and optimization metrics

## Base URL

```
http://localhost:3000
```

## Authentication

Currently, no authentication is required. Implement authentication middleware as needed for production.

## Content Type

All requests and responses use `application/json`.

---

## Endpoints

### Health & Status

#### GET /health
Check server health and readiness.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": 1704067200000
}
```

---

### Metrics Endpoints

#### POST /api/metrics/record
Record a single performance metric.

**Request:**
```json
{
  "serviceName": "space-traffic",
  "metricName": "avgResponseTime",
  "value": 45.5,
  "unit": "ms",
  "threshold": 50
}
```

**Response:**
```json
{
  "success": true,
  "message": "Metric recorded",
  "metric": {
    "serviceName": "space-traffic",
    "metricName": "avgResponseTime",
    "value": 45.5
  }
}
```

#### POST /api/metrics/batch
Record multiple metrics at once (more efficient).

**Request:**
```json
{
  "serviceName": "digital-twin",
  "metrics": [
    {
      "name": "propagationTime",
      "value": 95.2,
      "unit": "ms",
      "threshold": 100
    },
    {
      "name": "cacheHitRate",
      "value": 87.5,
      "unit": "%",
      "threshold": 70
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "2 metrics recorded",
  "count": 2
}
```

#### GET /api/metrics/{serviceName}
Get recent metrics for a service.

**Parameters:**
- `serviceName` (path) - Service name
- `metricName` (query, optional) - Filter by specific metric

**Response:**
```json
{
  "serviceName": "space-traffic",
  "metricCount": 10,
  "metrics": [
    {
      "serviceName": "space-traffic",
      "metricName": "avgResponseTime",
      "value": 48.2,
      "unit": "ms",
      "timestamp": 1704067200000
    }
  ]
}
```

---

### Health Endpoints

#### POST /api/health/update
Update service health status.

**Request:**
```json
{
  "serviceName": "thermal-engine",
  "status": "healthy",
  "uptime": 99.95,
  "averageLatency": 50,
  "errorRate": 0.05
}
```

**Response:**
```json
{
  "success": true,
  "message": "Service health updated",
  "serviceName": "thermal-engine",
  "status": "healthy"
}
```

**Status Values:**
- `healthy` - All metrics within thresholds
- `degraded` - Some metrics slightly out of range
- `unhealthy` - Multiple failures or critical issues

#### GET /api/health/{serviceName}
Get health status for specific service.

**Response:**
```json
{
  "serviceName": "thermal-engine",
  "status": "healthy",
  "uptime": 99.95,
  "averageLatency": 50,
  "errorRate": 0.05,
  "lastChecked": 1704067200000
}
```

#### GET /api/health
Get health status for all services.

**Response:**
```json
{
  "services": 12,
  "health": [
    {
      "serviceName": "space-traffic",
      "status": "healthy",
      "uptime": 99.9,
      "averageLatency": 45,
      "errorRate": 0.1,
      "lastChecked": 1704067200000
    }
  ]
}
```

---

### Alert Endpoints

#### GET /api/alerts
Get active alerts with optional filtering.

**Parameters:**
- `serviceName` (query, optional) - Filter by service
- `severity` (query, optional) - Filter by severity (critical, warning, info)

**Response:**
```json
{
  "alertCount": 3,
  "alerts": [
    {
      "alertId": "ALERT-1704067200001",
      "serviceName": "thermal-engine",
      "metricName": "updateRate",
      "severity": "critical",
      "message": "updateRate exceeded threshold: 95Hz (threshold: 100Hz)",
      "expectedValue": 100,
      "actualValue": 95,
      "timestamp": 1704067200000,
      "resolved": false
    }
  ]
}
```

#### GET /api/alerts/{serviceName}
Get alerts for specific service.

**Response:**
```json
{
  "serviceName": "thermal-engine",
  "alertCount": 2,
  "alerts": [...]
}
```

#### POST /api/alerts/{alertId}/resolve
Mark an alert as resolved.

**Response:**
```json
{
  "success": true,
  "message": "Alert resolved",
  "alertId": "ALERT-1704067200001"
}
```

---

### Dashboard Endpoints

#### GET /api/dashboard/summary
Get system-wide health summary for dashboard.

**Response:**
```json
{
  "totalServices": 12,
  "healthyServices": 10,
  "degradedServices": 2,
  "unhealthyServices": 0,
  "activeAlerts": 3,
  "criticalAlerts": 1,
  "avgUptimePercent": 98.5,
  "systemStatus": "degraded"
}
```

#### GET /api/dashboard/html
Get interactive HTML dashboard (rendered in browser).

**Response:** HTML document with responsive dashboard UI

#### GET /api/dashboard/metrics.json
Get dashboard data as JSON for programmatic access.

**Response:**
```json
{
  "timestamp": "2024-01-02T00:00:00.000Z",
  "systemStatus": "degraded",
  "totalServices": 12,
  "activeAlerts": 3,
  "avgUptimePercent": 98.5,
  "optimizationMetrics": [...]
}
```

#### GET /api/dashboard/metrics.csv
Download metrics as CSV file.

**Response:** CSV text file suitable for download

---

### Statistics Endpoints

#### GET /api/statistics/{serviceName}
Get detailed statistics for a service.

**Response:**
```json
{
  "serviceName": "space-traffic",
  "statistics": {
    "metricsCount": 50,
    "avgResponseTime": 48.3,
    "p95ResponseTime": 52.1,
    "p99ResponseTime": 54.8,
    "alertCount": 2,
    "health": {
      "serviceName": "space-traffic",
      "status": "healthy",
      "uptime": 99.9,
      "averageLatency": 45,
      "errorRate": 0.1,
      "lastChecked": 1704067200000
    }
  }
}
```

#### GET /api/optimization/summary
Get optimization metrics for all services.

**Response:**
```json
{
  "servicesOptimized": 12,
  "services": [
    {
      "serviceName": "space-traffic",
      "optimizationClass": "SpatialGrid",
      "performanceImprovement": "10-100x",
      "metricsTracked": 50,
      "status": "healthy"
    }
  ]
}
```

---

## Client Library

### Installation

```typescript
import { MonitoringAPIClient, createMonitoringClient } from '@orbitalmind/monitoring';
```

### Basic Usage

```typescript
// Create client
const client = createMonitoringClient('http://localhost:3000', {
  timeout: 5000,
  retries: 3,
});

// Check health
const health = await client.health();
console.log(health.status);

// Record metric
await client.recordMetric('my-service', 'responseTime', 45.5, {
  unit: 'ms',
  threshold: 50,
});

// Get metrics
const metrics = await client.getServiceMetrics('my-service');
console.log(metrics.metricCount);

// Update health
await client.updateHealth('my-service', 'healthy', {
  uptime: 99.95,
  averageLatency: 45,
  errorRate: 0.05,
});

// Get alerts
const alerts = await client.getAlerts('my-service');
console.log(alerts.alertCount);

// Get dashboard
const summary = await client.getDashboardSummary();
console.log(summary.systemStatus);
```

### Advanced Usage

#### Batch Recording

```typescript
await client.recordMetrics('my-service', [
  { name: 'latency', value: 50, unit: 'ms', threshold: 100 },
  { name: 'throughput', value: 1000, unit: 'ops/s' },
  { name: 'errorRate', value: 0.1, unit: '%', threshold: 1 },
]);
```

#### Filtering Alerts

```typescript
// Get critical alerts
const critical = await client.getAlerts(undefined, 'critical');

// Get service-specific warnings
const warnings = await client.getAlerts('my-service', 'warning');
```

#### Dashboard Export

```typescript
// Get JSON for API consumption
const json = await client.getDashboardJSON();

// Get CSV for analysis
const csv = await client.getDashboardCSV();

// Get HTML for embedding
const html = await client.getDashboardHTML();
```

---

## Error Handling

All endpoints return appropriate HTTP status codes:

- `200 OK` - Successful request
- `400 Bad Request` - Invalid parameters
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

Error responses include details:

```json
{
  "error": "Invalid request",
  "message": "Missing required field: serviceName"
}
```

---

## Rate Limiting

Currently, no rate limiting is implemented. For production, consider adding:
- Per-service request limits
- Per-IP throttling
- Burst allowances for batch operations

---

## Example: Service Integration

```typescript
import { createMonitoringClient } from '@orbitalmind/monitoring';

class ServiceMonitor {
  private client = createMonitoringClient('http://localhost:3000');
  private serviceName: string;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
  }

  async recordOperation(duration: number, success: boolean) {
    await this.client.recordMetric(
      this.serviceName,
      'operationTime',
      duration,
      { unit: 'ms', threshold: 100 }
    );

    if (!success) {
      await this.client.recordMetric(
        this.serviceName,
        'errorCount',
        1,
        { unit: 'count' }
      );
    }
  }

  async updateStatus() {
    const health = Math.random() > 0.1 ? 'healthy' : 'degraded';
    await this.client.updateHealth(this.serviceName, health, {
      uptime: 99.5,
      averageLatency: 50,
      errorRate: 0.05,
    });
  }

  async getDashboard() {
    return await this.client.getDashboardSummary();
  }
}

// Usage
const monitor = new ServiceMonitor('my-api');
monitor.recordOperation(45, true);
monitor.updateStatus();
```

---

## Configuration

### Server Configuration

```typescript
import { MonitoringAPIServer } from '@orbitalmind/monitoring';

const server = new MonitoringAPIServer(3000);

// Start server
await server.start();

// Get monitor instance
const monitor = server.getMonitor();

// Get metrics collector
const collector = server.getCollector('service-name');
```

### Client Configuration

```typescript
const client = createMonitoringClient('http://localhost:3000', {
  timeout: 10000,        // 10 seconds
  retries: 5,            // Retry up to 5 times
  headers: {
    'X-API-Key': 'your-key',
  },
});
```

---

## Best Practices

1. **Batch Metrics** - Use batch endpoint for multiple metrics
2. **Error Handling** - Implement proper error handling and retries
3. **Health Updates** - Update health regularly (every 5-10 seconds)
4. **Metric Naming** - Use consistent naming conventions
5. **Thresholds** - Define appropriate thresholds for alerts
6. **Cleanup** - Resolve alerts when issues are addressed

---

## Troubleshooting

### Connection Refused
- Ensure monitoring server is running
- Check port configuration (default: 3000)
- Verify firewall settings

### Metrics Not Appearing
- Confirm service name matches
- Check metric timestamp is recent
- Verify metric values are valid numbers

### Alerts Not Triggered
- Verify threshold values are configured
- Check metric values exceed thresholds
- Review alert severity classification

---

## API Changelog

### Version 1.0
- Initial API release
- Core endpoints for metrics, health, alerts
- Dashboard endpoints with HTML/JSON/CSV export
- Client library with retry logic

---

For more information, see the [README.md](README.md) and [PHASE_2_COMPLETION.md](../../../docs/PHASE_2_COMPLETION.md).
