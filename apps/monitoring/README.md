# OrbitalMind Optimization Monitoring System

Real-time monitoring, alerting, and visualization of optimization metrics for the OrbitalMind satellite constellation system.

## Features

### 📊 Real-Time Metrics Tracking
- Performance metric recording with automatic threshold detection
- Service health monitoring and status aggregation
- Historical metric storage (last 1000 entries per metric)
- Support for all 12 optimized services
- Automatic metric windowing and retention management
- Statistical analysis (average, percentiles, standard deviation)

### 🚨 Intelligent Alerting
- Automatic alert generation on threshold violations
- Severity classification (critical, warning, info)
- Alert resolution tracking
- Filter and aggregate alerts by service
- High-volume alert support (100+ concurrent alerts)
- **NEW (Phase 3):** Alert deduplication and smart grouping
- **NEW (Phase 3):** Configurable alert aggregation rules
- **NEW (Phase 3):** Automatic transient alert suppression

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

### 🎯 **NEW (Phase 3):** Performance Benchmarking
- Comprehensive before/after performance comparison
- Automatic improvement ratio calculation
- Statistical validation of optimizations
- Target achievement verification
- Multi-format export (JSON, CSV)

### 📋 **NEW (Phase 3):** SLA Compliance Tracking
- Multi-metric SLA target configuration
- Automatic compliance monitoring
- Violation detection and classification
- Uptime budget calculations
- Compliance reporting and trend analysis

### 🧠 **NEW (Phase 3):** Smart Alert Management
- Signature-based alert deduplication
- Pattern-based alert grouping
- Customizable aggregation rules
- Alert lifecycle management (acknowledge, resolve)
- Reduced alert fatigue through intelligent filtering

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

### 4. **NEW (Phase 3):** Service Integration

```typescript
import { SpaceTrafficServiceMonitor } from '@orbitalmind/monitoring';

// Initialize service monitor (works for all 12 services)
const monitor = new SpaceTrafficServiceMonitor();
await monitor.initialize();  // Starts automatic 5-second metric flushing

// Record service-specific metrics
monitor.recordCollisionDetection(satelliteCount, duration, detected);
monitor.recordTrafficOptimization(orbitalSlots, utilization);

// Update service health status
await monitor.updateHealth();
```

### 5. **NEW (Phase 3):** SLA Compliance Tracking

```typescript
import { SLATracker } from '@orbitalmind/monitoring';

const tracker = new SLATracker();

// Configure SLA targets
tracker.setSLATarget({
  serviceName: 'space-traffic',
  uptimePercent: 99.5,
  p95LatencyMs: 500,
  p99LatencyMs: 1000,
  errorRatePercent: 0.1,
  availabilityWindowDays: 30
});

// Record measurements
tracker.recordMeasurement({
  serviceName: 'space-traffic',
  uptime: 99.6,
  p95Latency: 450,
  p99Latency: 950,
  errorRate: 0.05
});

// Check compliance
const compliance = tracker.getCompliance('space-traffic');
console.log(`SLA Compliant: ${compliance.overall.compliant}`);
```

### 6. **NEW (Phase 3):** Alert Aggregation

```typescript
import { AlertAggregator } from '@orbitalmind/monitoring';

const aggregator = new AlertAggregator();

// Process alert (automatic deduplication & grouping)
const result = aggregator.processAlert({
  serviceName: 'thermal-engine',
  metricName: 'temperature',
  severity: 'warning',
  message: 'High temperature detected',
  instanceId: 'thermal-1'
});

// Get aggregated alerts
const activeGroups = aggregator.getAllAlertGroups();
const stats = aggregator.getStats();

console.log(`Duplicate filtered: ${result.isDuplicate}`);
console.log(`Deduplication rate: ${(stats.duplicatesFiltered / stats.totalAlertsProcessed * 100).toFixed(1)}%`);
```

### 7. **NEW (Phase 3):** Performance Benchmarking

```typescript
import { PerformanceBenchmark } from '@orbitalmind/monitoring';

const benchmark = new PerformanceBenchmark();

const result = await benchmark.runBenchmark(
  {
    name: 'Query Optimization',
    serviceName: 'blockchain',
    targetImprovement: 5,
    runs: 100
  },
  () => bruteForceImplementation(),
  () => optimizedImplementation()
);

console.log(`Improvement: ${result.improvement.toFixed(1)}x`);
console.log(`Target Met: ${result.meetsTarget}`);
```

### 8. **NEW (Phase 4):** Alert Escalation

```typescript
import { AlertEscalationManager } from '@orbitalmind/monitoring';

const escalationManager = new AlertEscalationManager();

// Track critical alert for escalation
const state = escalationManager.trackAlert({
  alertId: 'ALERT-001',
  groupId: 'GROUP-001',
  serviceName: 'space-traffic',
  severity: 'critical'
});

// Register callback to respond to escalations
escalationManager.onEscalation(async (state) => {
  console.log(`Alert escalated to ${state.currentLevel}`);
  // Create incident, page team, etc.
});

// Start periodic escalation checking (every 60 seconds)
escalationManager.startEscalationChecking(60);

// Acknowledge alert to stop escalation
escalationManager.acknowledgeAlert('ALERT-001', 'engineer@orbitalmind.io');

// Get escalation statistics
const stats = escalationManager.getStatistics();
console.log(`Escalation rate: ${(stats.escalationRate * 100).toFixed(1)}%`);
```

### 9. **NEW (Phase 4):** Incident Response Automation

```typescript
import { IncidentResponseManager } from '@orbitalmind/monitoring';

const incidentManager = new IncidentResponseManager();

// Create incident from critical alert
const incident = await incidentManager.createIncidentFromAlert(
  'ALERT-002',
  {
    serviceName: 'blockchain',
    severity: 'critical',
    message: 'Database connection pool exhausted'
  },
  'monitor@orbitalmind.io'
);

// Update incident status through lifecycle
incidentManager.updateIncidentStatus(
  incident.id,
  'investigating',
  'engineer@orbitalmind.io',
  'Started root cause analysis'
);

// Assign incident to team member
incidentManager.assignIncident(
  incident.id,
  'alice@orbitalmind.io',
  'incident-commander@orbitalmind.io'
);

// Add timeline entries for audit trail
incidentManager.addTimelineEntry(
  incident.id,
  'root-cause-identified',
  'engineer@orbitalmind.io',
  'Memory leak in thermal calculation module'
);

// Close incident and record metrics
incidentManager.closeIncident(
  incident.id,
  'engineer@orbitalmind.io',
  'Issue resolved by deploying patch v1.2.1'
);

// Get incident statistics and MTTR
const stats = incidentManager.getStatistics();
console.log(`Avg resolution time: ${stats.avgResolutionTime.toFixed(1)} minutes`);
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

### **NEW (Phase 3):** Service Integration Monitors
12 service-specific monitors providing standardized integration patterns:
- `SpaceTrafficServiceMonitor` - Collision detection, traffic optimization
- `DigitalTwinServiceMonitor` - Propagation, cache, sync metrics
- `OrbitalNetworkingServiceMonitor` - Routing, link utilization
- `ThermalEngineServiceMonitor` - Temperature, thermal calculations
- `ScienceOpsServiceMonitor` - Spectral analysis, NDVI calculations
- `BlockchainServiceMonitor` - Query caching, transactions
- Plus 6 additional service monitors for complete coverage

**File:** `src/service-integration-examples.ts`

### **NEW (Phase 3):** SLA Tracker
Service Level Agreement compliance monitoring:
- Multi-metric SLA target configuration
- Automatic compliance calculation
- Violation detection and classification
- Uptime budget management
- JSON/CSV compliance reporting

**File:** `src/sla-tracker.ts`

### **NEW (Phase 3):** Alert Aggregator
Intelligent alert management to reduce fatigue:
- Signature-based deduplication
- Pattern-based alert grouping
- Customizable aggregation rules
- Transient alert suppression
- Alert lifecycle management

**File:** `src/alert-aggregation.ts`

### **NEW (Phase 3):** Performance Benchmarking
Validation framework for optimization improvements:
- Before/after performance comparison
- Statistical analysis (average, std dev)
- Target achievement verification
- Multi-format export capabilities

**File:** `src/performance-benchmarks.ts`

### **NEW (Phase 4):** Alert Escalation Manager
Time-based alert escalation with automatic notifications:
- Multi-level escalation (level-1 through level-4)
- Configurable delay intervals per level
- Acknowledgment override to stop escalation
- Escalation callbacks for external system integration
- Complete escalation history and timeline tracking
- Statistics and reporting (escalation rate, MTTR)

**File:** `src/alert-escalation.ts`

### **NEW (Phase 4):** Incident Response Manager
Automatic incident creation and lifecycle management:
- Rule-based incident creation from alerts, SLA violations, escalations
- Incident severity levels (Sev1-Sev4) with status tracking
- Lifecycle management (open → investigating → mitigating → resolved → closed)
- External system integration (Jira, ServiceNow, OpsGenie, VictorOps)
- Timeline-based incident history with audit trail
- MTTR calculation and resolution time metrics

**File:** `src/incident-response.ts`

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

## Documentation

### Phase 2: Core Monitoring (Initial Release)
- **Completion Status:** ✅ Complete
- **Components:** 13 monitoring subsystems
- **Documentation:** See [PHASE_2_COMPLETION.md](../../docs/PHASE_2_COMPLETION.md)

### Phase 3: API Layer & Advanced Features (Current)
- **Completion Status:** ✅ Complete
- **New Components:** Performance benchmarking, service integration, SLA tracking, alert aggregation
- **Documentation:** 
  - [PHASE_3_COMPLETION.md](../../docs/PHASE_3_COMPLETION.md) - Feature overview and integration examples
  - [PRODUCTION_DEPLOYMENT_GUIDE.md](../../docs/PRODUCTION_DEPLOYMENT_GUIDE.md) - Complete deployment instructions
  - [API_REFERENCE.md](./API_REFERENCE.md) - REST API endpoint documentation

### Phase 4: Alert Escalation & Incident Response (Current)
- **Completion Status:** ✅ Complete
- **New Components:** Alert escalation policies, incident response automation
- **Documentation:** 
  - [PHASE_4_COMPLETION.md](../../docs/PHASE_4_COMPLETION.md) - Feature overview and integration patterns
  - Updated [PRODUCTION_DEPLOYMENT_GUIDE.md](../../docs/PRODUCTION_DEPLOYMENT_GUIDE.md) - Escalation and incident configuration

### Phase 5: Planned Enhancements
- Custom rule management API
- Alert correlation engine
- Predictive SLA violation detection
- Advanced metrics and analytics dashboards

## Production Checklist

### Core Monitoring
- [ ] Review [PRODUCTION_DEPLOYMENT_GUIDE.md](../../docs/PRODUCTION_DEPLOYMENT_GUIDE.md)
- [ ] Configure alert thresholds for your environment
- [ ] Set up notification handlers (email, Slack, webhooks)
- [ ] Deploy monitoring infrastructure to Kubernetes
- [ ] Configure dashboard hosting
- [ ] Set up log persistence and backups

### Phase 3: SLA & Alert Management
- [ ] Configure SLA targets for all 12 services
- [ ] Test alert aggregation and deduplication
- [ ] Verify alert filtering and suppression rules

### Phase 4: Escalation & Incident Response
- [ ] Configure alert escalation policies
- [ ] Register external incident systems (Jira, ServiceNow, OpsGenie)
- [ ] Set up escalation notification channels (Slack, email, PagerDuty, SMS)
- [ ] Configure incident creation rules for your environment
- [ ] Test escalation workflows end-to-end
- [ ] Set up incident commander rotation
- [ ] Create incident response runbooks

### Operations
- [ ] Create runbooks for common alerts
- [ ] Set up monitoring of the monitoring system
- [ ] Train team on operational procedures
- [ ] Establish incident response procedures
- [ ] Document escalation chains and approval processes
- [ ] Set up incident postmortem review process

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
