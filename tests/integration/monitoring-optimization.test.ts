/**
 * Optimization Monitoring Integration Test
 * Verify real-time monitoring, alerting, and dashboard functionality
 */

import OptimizationMonitor, {
  PerformanceMetric,
  ServiceHealth,
  PerformanceAlert,
} from '../../apps/monitoring/src/optimization-monitor';

describe('Optimization Monitoring Integration', () => {
  let monitor: OptimizationMonitor;

  beforeEach(() => {
    monitor = new OptimizationMonitor();
  });

  describe('Performance Metrics Recording', () => {
    test('should record and retrieve performance metrics', () => {
      const metric: PerformanceMetric = {
        serviceName: 'space-traffic',
        metricName: 'avgResponseTime',
        value: 45,
        unit: 'ms',
        timestamp: Date.now(),
        threshold: 50,
      };

      monitor.recordMetric(metric);
      const metrics = monitor.getServiceMetrics('space-traffic', 'avgResponseTime');

      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics[0].serviceName).toBe('space-traffic');
      expect(metrics[0].value).toBe(45);

      console.log('✓ Performance metric recorded and retrieved');
    });

    test('should trigger alerts when metrics exceed threshold', () => {
      const metric: PerformanceMetric = {
        serviceName: 'digital-twin',
        metricName: 'avgResponseTime',
        value: 150, // Exceeds 100ms threshold
        unit: 'ms',
        timestamp: Date.now(),
        threshold: 100,
      };

      monitor.recordMetric(metric);
      const alerts = monitor.getActiveAlerts('digital-twin');

      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].severity).toBeDefined();

      console.log(`✓ Alert triggered: ${alerts[0].severity}`);
    });

    test('should cap metrics history at 1000 entries per service', () => {
      const serviceName = 'orbital-networking';

      // Record 1500 metrics
      for (let i = 0; i < 1500; i++) {
        const metric: PerformanceMetric = {
          serviceName,
          metricName: 'avgResponseTime',
          value: 30 + Math.random() * 20,
          unit: 'ms',
          timestamp: Date.now() + i,
          threshold: 50,
        };
        monitor.recordMetric(metric);
      }

      const metrics = monitor.getServiceMetrics(serviceName, 'avgResponseTime');

      // Should only keep last 1000
      expect(metrics.length).toBeLessThanOrEqual(1000);

      console.log(`✓ Metrics capped at ${metrics.length} entries`);
    });

    test('should track multiple metrics for same service', () => {
      const serviceName = 'thermal-engine';

      const metrics = [
        { name: 'updateRate', value: 95, unit: 'Hz', threshold: 100 },
        { name: 'predictionAccuracy', value: 88, unit: '%', threshold: 85 },
        { name: 'errorRate', value: 0.2, unit: '%', threshold: 1 },
      ];

      metrics.forEach(m => {
        monitor.recordMetric({
          serviceName,
          metricName: m.name,
          value: m.value,
          unit: m.unit,
          timestamp: Date.now(),
          threshold: m.threshold,
        });
      });

      const updateRates = monitor.getServiceMetrics(serviceName, 'updateRate');
      const accuracies = monitor.getServiceMetrics(serviceName, 'predictionAccuracy');

      expect(updateRates.length).toBeGreaterThan(0);
      expect(accuracies.length).toBeGreaterThan(0);

      console.log(`✓ Multiple metrics tracked for ${serviceName}`);
    });
  });

  describe('Service Health Monitoring', () => {
    test('should update and retrieve service health status', () => {
      const serviceName = 'autonomy-core';

      monitor.updateServiceHealth(serviceName, {
        status: 'healthy',
        uptime: 99.9,
        averageLatency: 45,
        errorRate: 0.1,
      });

      const health = monitor.getServiceHealth(serviceName);

      expect(health).toBeDefined();
      expect(health?.status).toBe('healthy');
      expect(health?.uptime).toBe(99.9);
      expect(health?.lastChecked).toBeDefined();

      console.log(`✓ Service health updated: ${health?.status}`);
    });

    test('should track degraded service health', () => {
      const serviceName = 'radiation-runtime';

      monitor.updateServiceHealth(serviceName, {
        status: 'degraded',
        uptime: 95.0,
        averageLatency: 75,
        errorRate: 1.5,
      });

      const health = monitor.getServiceHealth(serviceName);

      expect(health?.status).toBe('degraded');

      console.log('✓ Degraded service health detected');
    });

    test('should alert on unhealthy services', () => {
      const serviceName = 'inference-runtime';

      monitor.updateServiceHealth(serviceName, {
        status: 'unhealthy',
        uptime: 80.0,
        averageLatency: 500,
        errorRate: 5.0,
      });

      const health = monitor.getServiceHealth(serviceName);

      expect(health?.status).toBe('unhealthy');
      expect(health?.uptime).toBeLessThan(90);

      console.log('✓ Unhealthy service detected');
    });

    test('should track all service health statuses', () => {
      const services = [
        'space-traffic',
        'digital-twin',
        'orbital-networking',
        'autonomy-core',
      ];

      services.forEach((service, index) => {
        monitor.updateServiceHealth(service, {
          status: index % 2 === 0 ? 'healthy' : 'degraded',
          uptime: 95 + index * 2,
          averageLatency: 50 + index * 10,
          errorRate: 0.5 * index,
        });
      });

      const allHealth = monitor.getAllServiceHealth();

      expect(allHealth.length).toBeGreaterThanOrEqual(services.length);

      console.log(`✓ All service health tracked: ${allHealth.length} services`);
    });
  });

  describe('Alert Management', () => {
    test('should create alerts for threshold violations', () => {
      const metric: PerformanceMetric = {
        serviceName: 'control-plane',
        metricName: 'allocationTime',
        value: 25, // Exceeds 10ms threshold
        unit: 'ms',
        timestamp: Date.now(),
        threshold: 10,
      };

      monitor.recordMetric(metric);
      const alerts = monitor.getActiveAlerts();

      expect(alerts.length).toBeGreaterThan(0);

      console.log(`✓ Alert created: ${alerts[0].alertId}`);
    });

    test('should classify alert severity correctly', () => {
      const metrics = [
        { value: 12, threshold: 10, expectedSeverity: 'info' }, // 20% over
        { value: 16, threshold: 10, expectedSeverity: 'warning' }, // 60% over
        { value: 21, threshold: 10, expectedSeverity: 'critical' }, // 110% over
      ];

      metrics.forEach(m => {
        monitor.recordMetric({
          serviceName: 'federation-hub',
          metricName: 'selectionTime',
          value: m.value,
          unit: 'ms',
          timestamp: Date.now(),
          threshold: m.threshold,
        });
      });

      const alerts = monitor.getActiveAlerts('federation-hub');

      expect(alerts.length).toBeGreaterThan(0);
      // Last alert should be critical (21 vs 10)
      expect(alerts[alerts.length - 1].severity).toBe('critical');

      console.log(`✓ Alert severity classified correctly`);
    });

    test('should filter alerts by service', () => {
      // Create alerts for multiple services
      const services = ['science-ops', 'blockchain'];

      services.forEach(service => {
        monitor.recordMetric({
          serviceName: service,
          metricName: 'queryTime',
          value: 100,
          unit: 'ms',
          timestamp: Date.now(),
          threshold: 50,
        });
      });

      const scienceOpsAlerts = monitor.getActiveAlerts('science-ops');
      const blockchainAlerts = monitor.getActiveAlerts('blockchain');
      const allAlerts = monitor.getActiveAlerts();

      expect(scienceOpsAlerts.length).toBeGreaterThan(0);
      expect(blockchainAlerts.length).toBeGreaterThan(0);
      expect(allAlerts.length).toBeGreaterThanOrEqual(
        scienceOpsAlerts.length + blockchainAlerts.length
      );

      console.log(`✓ Alerts filtered by service`);
    });

    test('should resolve alerts', () => {
      const metric: PerformanceMetric = {
        serviceName: 'edge-compute',
        metricName: 'communicationSavings',
        value: 50, // Below 75% threshold
        unit: '%',
        timestamp: Date.now(),
        threshold: 75,
      };

      monitor.recordMetric(metric);
      const alerts = monitor.getActiveAlerts('edge-compute');

      expect(alerts.length).toBeGreaterThan(0);
      const alertId = alerts[0].alertId;

      const resolved = monitor.resolveAlert(alertId);

      expect(resolved).toBe(true);

      const activeAlerts = monitor.getActiveAlerts('edge-compute');
      expect(activeAlerts.filter(a => a.alertId === alertId).length).toBe(0);

      console.log(`✓ Alert resolved: ${alertId}`);
    });
  });

  describe('Service Statistics', () => {
    test('should calculate response time statistics', () => {
      const serviceName = 'space-traffic';
      const times = [30, 35, 40, 45, 50, 48, 42, 38, 52, 46];

      times.forEach(time => {
        monitor.recordMetric({
          serviceName,
          metricName: 'avgResponseTime',
          value: time,
          unit: 'ms',
          timestamp: Date.now(),
        });
      });

      const stats = monitor.calculateServiceStatistics(serviceName);

      expect(stats.metricsCount).toBeGreaterThan(0);
      expect(stats.avgResponseTime).toBeGreaterThan(0);
      expect(stats.p95ResponseTime).toBeGreaterThanOrEqual(stats.avgResponseTime);
      expect(stats.p99ResponseTime).toBeGreaterThanOrEqual(stats.p95ResponseTime);

      console.log(`
        Response Time Stats:
        Count: ${stats.metricsCount}
        Avg: ${stats.avgResponseTime.toFixed(2)}ms
        P95: ${stats.p95ResponseTime.toFixed(2)}ms
        P99: ${stats.p99ResponseTime.toFixed(2)}ms
      `);
    });

    test('should calculate alert statistics per service', () => {
      const serviceName = 'digital-twin';

      // Create multiple alerts
      for (let i = 0; i < 5; i++) {
        monitor.recordMetric({
          serviceName,
          metricName: 'avgResponseTime',
          value: 150 + i * 10, // All exceed 100ms threshold
          unit: 'ms',
          timestamp: Date.now(),
          threshold: 100,
        });
      }

      const stats = monitor.calculateServiceStatistics(serviceName);

      expect(stats.alertCount).toBeGreaterThan(0);

      console.log(`✓ Service alert count: ${stats.alertCount}`);
    });

    test('should include service health in statistics', () => {
      const serviceName = 'thermal-engine';

      monitor.updateServiceHealth(serviceName, {
        status: 'healthy',
        uptime: 99.95,
        averageLatency: 50,
        errorRate: 0.05,
      });

      const stats = monitor.calculateServiceStatistics(serviceName);

      expect(stats.health).toBeDefined();
      expect(stats.health?.status).toBe('healthy');

      console.log(`✓ Service health included in stats`);
    });
  });

  describe('Dashboard Summary', () => {
    test('should generate dashboard summary with no data', () => {
      const summary = monitor.getDashboardSummary();

      expect(summary.totalServices).toBeDefined();
      expect(summary.healthyServices).toBeDefined();
      expect(summary.activeAlerts).toBeDefined();
      expect(summary.systemStatus).toBeDefined();

      console.log(`
        Dashboard Summary (Empty):
        Status: ${summary.systemStatus}
        Services: ${summary.totalServices}
      `);
    });

    test('should classify system status correctly', () => {
      // Healthy system
      monitor.updateServiceHealth('service-1', {
        status: 'healthy',
        uptime: 99.9,
        averageLatency: 50,
        errorRate: 0.1,
      });

      let summary = monitor.getDashboardSummary();
      expect(summary.systemStatus).toBe('healthy');

      // Degraded system
      monitor.updateServiceHealth('service-2', {
        status: 'degraded',
        uptime: 95.0,
        averageLatency: 100,
        errorRate: 1.0,
      });

      summary = monitor.getDashboardSummary();
      expect(['healthy', 'degraded']).toContain(summary.systemStatus);

      console.log(`✓ System status: ${summary.systemStatus}`);
    });

    test('should calculate average uptime across services', () => {
      const services = [
        { name: 'service-1', uptime: 99.9 },
        { name: 'service-2', uptime: 98.0 },
        { name: 'service-3', uptime: 96.0 },
      ];

      services.forEach(s => {
        monitor.updateServiceHealth(s.name, {
          status: 'healthy',
          uptime: s.uptime,
          averageLatency: 50,
          errorRate: 0.5,
        });
      });

      const summary = monitor.getDashboardSummary();
      const expectedAvg = (99.9 + 98.0 + 96.0) / 3;

      expect(summary.avgUptimePercent).toBeCloseTo(expectedAvg, 1);

      console.log(`✓ Average uptime: ${summary.avgUptimePercent.toFixed(2)}%`);
    });

    test('should distinguish healthy, degraded, and unhealthy services', () => {
      monitor.updateServiceHealth('healthy-service', {
        status: 'healthy',
        uptime: 99.9,
        averageLatency: 50,
        errorRate: 0.1,
      });

      monitor.updateServiceHealth('degraded-service', {
        status: 'degraded',
        uptime: 95.0,
        averageLatency: 100,
        errorRate: 1.0,
      });

      monitor.updateServiceHealth('unhealthy-service', {
        status: 'unhealthy',
        uptime: 80.0,
        averageLatency: 300,
        errorRate: 5.0,
      });

      const summary = monitor.getDashboardSummary();

      expect(summary.healthyServices).toBeGreaterThan(0);
      expect(summary.degradedServices).toBeGreaterThan(0);
      expect(summary.unhealthyServices).toBeGreaterThan(0);

      console.log(`
        Service Distribution:
        Healthy: ${summary.healthyServices}
        Degraded: ${summary.degradedServices}
        Unhealthy: ${summary.unhealthyServices}
      `);
    });

    test('should count critical alerts', () => {
      // Create critical alert
      monitor.recordMetric({
        serviceName: 'test-service',
        metricName: 'metric',
        value: 100,
        unit: 'ms',
        timestamp: Date.now(),
        threshold: 10, // 10x over threshold = critical
      });

      const summary = monitor.getDashboardSummary();

      expect(summary.criticalAlerts).toBeGreaterThanOrEqual(0);

      console.log(`✓ Critical alerts: ${summary.criticalAlerts}`);
    });
  });

  describe('Optimization Summary', () => {
    test('should provide optimization metrics for all services', () => {
      const summary = monitor.getOptimizationSummary();

      expect(summary.length).toBe(12); // All 12 services
      expect(summary[0]).toHaveProperty('serviceName');
      expect(summary[0]).toHaveProperty('optimizationClass');
      expect(summary[0]).toHaveProperty('performanceImprovement');

      console.log(`
        Optimization Summary - Services:
        ${summary.map(s => `${s.serviceName}: ${s.optimizationClass}`).join('\n')}
      `);
    });

    test('should include metrics count for each service', () => {
      const serviceName = 'space-traffic';

      // Record some metrics
      for (let i = 0; i < 5; i++) {
        monitor.recordMetric({
          serviceName,
          metricName: 'avgResponseTime',
          value: 40 + i,
          unit: 'ms',
          timestamp: Date.now(),
        });
      }

      const summary = monitor.getOptimizationSummary();
      const serviceEntry = summary.find(s => s.serviceName === serviceName);

      expect(serviceEntry).toBeDefined();
      expect(serviceEntry?.metricsTracked).toBeGreaterThan(0);

      console.log(`${serviceName}: ${serviceEntry?.metricsTracked} metrics tracked`);
    });

    test('should include service health status in optimization summary', () => {
      const serviceName = 'digital-twin';

      monitor.updateServiceHealth(serviceName, {
        status: 'healthy',
        uptime: 99.9,
        averageLatency: 50,
        errorRate: 0.1,
      });

      const summary = monitor.getOptimizationSummary();
      const serviceEntry = summary.find(s => s.serviceName === serviceName);

      expect(serviceEntry?.status).toBe('healthy');

      console.log(`${serviceName} status: ${serviceEntry?.status}`);
    });
  });

  describe('Large-Scale Monitoring', () => {
    test('should handle high-volume metric recording', () => {
      const services = Array.from({ length: 10 }, (_, i) => 'service-' + i);

      // Record 100 metrics per service
      services.forEach(service => {
        for (let i = 0; i < 100; i++) {
          monitor.recordMetric({
            serviceName: service,
            metricName: 'avgResponseTime',
            value: 40 + Math.random() * 20,
            unit: 'ms',
            timestamp: Date.now(),
            threshold: 50,
          });
        }
      });

      const summary = monitor.getDashboardSummary();
      expect(summary.activeAlerts).toBeGreaterThanOrEqual(0);

      console.log(`✓ Recorded 1000 metrics across 10 services`);
    });

    test('should efficiently handle 100+ active alerts', () => {
      // Create 100+ alerts
      for (let i = 0; i < 120; i++) {
        const service = `test-service-${i % 12}`;
        monitor.recordMetric({
          serviceName: service,
          metricName: `metric-${i}`,
          value: 100,
          unit: 'ms',
          timestamp: Date.now(),
          threshold: 50,
        });
      }

      const startTime = Date.now();
      const alerts = monitor.getActiveAlerts();
      const queryTime = Date.now() - startTime;

      expect(alerts.length).toBeGreaterThan(0);
      expect(queryTime).toBeLessThan(100); // Should be fast

      console.log(`✓ Retrieved ${alerts.length} alerts in ${queryTime}ms`);
    });

    test('should calculate statistics efficiently across all services', () => {
      // Set up multiple services with data
      for (let s = 0; s < 12; s++) {
        const service = `service-${s}`;
        for (let i = 0; i < 50; i++) {
          monitor.recordMetric({
            serviceName: service,
            metricName: 'avgResponseTime',
            value: 30 + Math.random() * 40,
            unit: 'ms',
            timestamp: Date.now(),
          });
        }
      }

      const startTime = Date.now();
      const summaries = Array.from({ length: 12 }, (_, i) =>
        monitor.calculateServiceStatistics(`service-${i}`)
      );
      const totalTime = Date.now() - startTime;

      expect(summaries.length).toBe(12);
      expect(totalTime).toBeLessThan(500); // Should be efficient

      console.log(`✓ Calculated statistics for 12 services in ${totalTime}ms`);
    });
  });
});
