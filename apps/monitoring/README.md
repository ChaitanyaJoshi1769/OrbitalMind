# OrbitalMind Optimization Monitoring System

Real-time monitoring, alerting, and visualization of optimization metrics for the OrbitalMind satellite constellation system.

## Features

### 📊 Real-Time Metrics Tracking
- Performance metric recording with automatic threshold detection
- Service health monitoring and status aggregation
- Historical metric storage (last 1000 entries per metric)
- Support for all 12 optimized services

### 🚨 Intelligent Alerting
- Automatic alert generation on threshold violations
- Severity classification (critical, warning, info)
- Alert resolution tracking
- Filter and aggregate alerts by service
- High-volume alert support (100+ concurrent alerts)

### 📈 Interactive Dashboard
- Real-time HTML dashboard with responsive design
- Service health cards with latency and uptime metrics
- Alert summary with recent alerts
- Optimization metrics table showing performance improvements
- System status classification (healthy, degraded, critical)

### 📤 Multi-Channel Notifications
- Console logging with severity levels
- File-based alert persistence
- Webhook integration for custom systems
- Slack integration for team notifications
- Email notification stubs for service integration

### 💾 Data Export
- JSON export for metrics and dashboard state
- CSV export for metrics analysis
- Integration-ready APIs for external systems

## Installation

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests
npm test
```

## Quick Start

### 1. Basic Monitoring

```typescript
import { OptimizationMonitor } from '@orbitalmind/monitoring';

// Create monitor instance
const monitor = new OptimizationMonitor();

// Record performance metrics
monitor.recordMetric({
  serviceName: 'space-traffic',
  metricName: 'avgResponseTime',
  value: 45,
  unit: 'ms',
  timestamp: Date.now(),
  threshold: 50,
});

// Update service health
monitor.updateServiceHealth('space-traffic', {
  status: 'healthy',
  uptime: 99.95,
  averageLatency: 45,
  errorRate: 0.05,
});

// Get active alerts
const alerts = monitor.getActiveAlerts('space-traffic');
console.log(`Active alerts: ${alerts.length}`);

// Get dashboard summary
const summary = monitor.getDashboardSummary();
console.log(`System status: ${summary.systemStatus}`);
```

### 2. Generate Dashboard

```typescript
import { DashboardGenerator } from '@orbitalmind/monitoring';

const generator = new DashboardGenerator();

// Populate with sample data
generator.generateSampleData();

// Print summary to console
generator.printSummary();

// Save HTML dashboard
generator.saveDashboard('/path/to/dashboard.html');

// Get metrics as JSON
const metricsJson = generator.getMetricsJSON();
```

### 3. Set Up Alerting

```typescript
import { AlertNotificationManager } from '@orbitalmind/monitoring';

// Create manager with multiple handlers
const alertManager = AlertNotificationManager.createFromConfig({
  console: true,
  file: '/var/log/orbitalmind-alerts.log',
  webhook: {
    url: 'https://your-system.com/alerts',
    headers: { 'Authorization': 'Bearer token123' },
  },
  slack: {
    webhookUrl: 'https://hooks.slack.com/services/xxx/yyy/zzz',
    channel: '#critical-alerts',
  },
});

// Send alerts
const alerts = monitor.getActiveAlerts();
await alertManager.notifyAlerts(alerts);
```

## Architecture

### OptimizationMonitor
Core monitoring engine that:
- Records performance metrics with threshold detection
- Tracks service health status
- Manages alert lifecycle (creation, resolution)
- Calculates service statistics and dashboard summaries
- Provides query interfaces for metrics and alerts

**File:** `src/optimization-monitor.ts`

### OptimizationDashboardUI
Dashboard generation and data export:
- Generates responsive HTML dashboard
- Provides JSON and CSV export capabilities
- Renders service health cards
- Displays optimization metrics table
- Shows recent alerts and alert summary

**File:** `src/dashboard-ui.ts`

### DashboardGenerator
Sample data generation and dashboard creation:
- Populates monitor with realistic metrics
- Generates dashboard HTML files
- Exports metrics as JSON
- Prints console summary

**File:** `src/dashboard-generator.ts`

### AlertNotificationManager
Multi-channel alert distribution:
- Supports console, file, email, webhook, Slack
- Configuration-based handler setup
- Error handling with graceful degradation
- High-volume alert processing

**File:** `src/alerting-system.ts`

## Monitoring Thresholds

The monitoring system tracks 12 optimized services with thresholds:

| Service | Metric | Threshold |
|---------|--------|-----------|
| space-traffic | avgResponseTime | 50ms |
| space-traffic | errorRate | 1% |
| digital-twin | avgResponseTime | 100ms |
| digital-twin | cacheHitRate | 70% (minimum) |
| orbital-networking | avgResponseTime | 50ms |
| orbital-networking | routingTime | 500ms |
| autonomy-core | convergenceTime | 1000ms |
| autonomy-core | errorRate | 2% |
| thermal-engine | updateRate | 100Hz |
| thermal-engine | predictionAccuracy | 85% (minimum) |
| radiation-runtime | errorCorrectionTime | 50ms |
| radiation-runtime | blockProcessingRate | 1000/s |
| inference-runtime | compressionRatio | 4 (minimum) |
| inference-runtime | inferenceTime | 200ms |
| edge-compute | compressionRatio | 4 (minimum) |
| edge-compute | communicationSavings | 75% (minimum) |
| control-plane | allocationTime | 10ms |
| control-plane | scalingEfficiency | 90% (minimum) |
| federation-hub | selectionTime | 5ms |
| federation-hub | handoffSuccessRate | 95% (minimum) |
| science-ops | spectralAnalysisTime | 50ms |
| science-ops | targetSelectionTime | 5ms |
| blockchain | queryTime | 10ms |
| blockchain | cacheHitRate | 80% (minimum) |

## API Reference

### OptimizationMonitor

#### recordMetric(metric: PerformanceMetric): void
Records a performance metric with automatic threshold checking.

```typescript
monitor.recordMetric({
  serviceName: 'service-name',
  metricName: 'metric-name',
  value: 100,
  unit: 'ms',
  timestamp: Date.now(),
  threshold: 50,
});
```

#### updateServiceHealth(serviceName: string, health: Omit<ServiceHealth, 'serviceName' | 'lastChecked'>): void
Updates health status for a service.

```typescript
monitor.updateServiceHealth('service-name', {
  status: 'healthy',
  uptime: 99.95,
  averageLatency: 50,
  errorRate: 0.05,
});
```

#### getServiceHealth(serviceName: string): ServiceHealth | undefined
Retrieves current health for a service.

#### getAllServiceHealth(): ServiceHealth[]
Gets health status for all monitored services.

#### getActiveAlerts(serviceName?: string): PerformanceAlert[]
Retrieves active (unresolved) alerts, optionally filtered by service.

#### getServiceMetrics(serviceName: string, metricName?: string): PerformanceMetric[]
Retrieves metrics for a service, optionally filtered by metric name.

#### calculateServiceStatistics(serviceName: string)
Calculates P95, P99 response times and alert counts.

#### getDashboardSummary()
Generates system-wide health summary with status classification.

#### getOptimizationSummary()
Returns optimization metrics for all 12 services.

#### resolveAlert(alertId: string): boolean
Marks an alert as resolved.

### OptimizationDashboardUI

#### static generateDashboardHTML(dashboardData: any): string
Generates responsive HTML dashboard.

#### static generateMetricsJSON(dashboardData: any): string
Exports metrics as JSON.

#### static generateMetricsCSV(services: ServiceCard[]): string
Exports service metrics as CSV.

### DashboardGenerator

#### generateSampleData(): void
Populates monitor with realistic sample metrics.

#### generateDashboard(): string
Generates dashboard HTML from current monitor state.

#### saveDashboard(filePath?: string): void
Saves dashboard HTML to file.

#### getMetricsJSON(): string
Returns metrics as JSON string.

#### printSummary(): void
Prints formatted console summary.

### AlertNotificationManager

#### static createFromConfig(config: AlertNotificationConfig)
Creates manager from configuration object.

#### addHandler(handler: AlertNotificationHandler): void
Adds a notification handler.

#### async notifyAlert(alert: PerformanceAlert): Promise<void>
Sends alert to all handlers.

#### async notifyAlerts(alerts: PerformanceAlert[]): Promise<void>
Sends multiple alerts to all handlers.

## Testing

Comprehensive test coverage including:
- 20+ monitoring functionality tests
- 15+ dashboard generation and export tests
- 20+ alerting system integration tests

Run tests:
```bash
npm test
```

## Performance

- **Metric Recording:** O(1) with automatic capping at 1000 entries
- **Alert Retrieval:** <100ms for 100+ alerts
- **Dashboard Generation:** <1 second for 12 services
- **Service Statistics:** O(n) single-pass calculation
- **High-Volume Alerts:** Support for 100+ concurrent alerts

## Integration Guide

### With External Systems

#### Email Notifications
Extend `EmailAlertHandler` to integrate with services like SendGrid or AWS SES.

#### Slack Integration
Update webhook URL in `SlackAlertHandler` configuration:
```typescript
{
  slack: {
    webhookUrl: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL',
    channel: '#critical-alerts',
  }
}
```

#### Custom Webhooks
Any HTTP endpoint can receive alerts via webhook integration:
```typescript
{
  webhook: {
    url: 'https://your-system.com/api/alerts',
    headers: { 'Authorization': 'Bearer token' },
  }
}
```

### Embedding in Web Application

```typescript
const html = monitor.getDashboardSummary();
const dashboardHTML = OptimizationDashboardUI.generateDashboardHTML(html);

// Serve as HTTP response
response.setHeader('Content-Type', 'text/html');
response.send(dashboardHTML);
```

## Production Checklist

- [ ] Configure alert thresholds for your environment
- [ ] Set up notification handlers (email, Slack, webhooks)
- [ ] Deploy monitoring infrastructure
- [ ] Configure dashboard hosting
- [ ] Set up log persistence
- [ ] Establish alert escalation procedures
- [ ] Create runbooks for common alerts
- [ ] Set up monitoring of the monitoring system

## Troubleshooting

### High Alert Volume
- Review and adjust thresholds
- Implement alert deduplication
- Consider alert batching

### Dashboard Performance
- Monitor query time trends
- Consider caching strategies
- Implement pagination for large service lists

### Notification Failures
- Check handler configuration
- Verify network connectivity
- Review error logs for handler-specific issues

## Contributing

Contributions welcome! Areas for enhancement:
- Additional notification handlers
- Advanced visualization options
- Machine learning-based anomaly detection
- Distributed monitoring support

## License

MIT - See LICENSE file for details

## Support

For issues and questions:
- Create an issue in the OrbitalMind repository
- Contact the development team
- Check the troubleshooting guide

---

**OrbitalMind Optimization Dashboard** | Real-time monitoring for satellite constellation optimization
