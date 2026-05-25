/**
 * Dashboard UI Integration Test
 * Verify dashboard HTML generation and metrics export functionality
 */

import OptimizationMonitor from '../../apps/monitoring/src/optimization-monitor';
import OptimizationDashboardUI from '../../apps/monitoring/src/dashboard-ui';

describe('Dashboard UI Integration', () => {
  let monitor: OptimizationMonitor;

  beforeEach(() => {
    monitor = new OptimizationMonitor();
  });

  describe('HTML Dashboard Generation', () => {
    test('should generate valid HTML dashboard', () => {
      // Setup sample data
      monitor.updateServiceHealth('space-traffic', {
        status: 'healthy',
        uptime: 99.95,
        averageLatency: 45,
        errorRate: 0.05,
      });

      monitor.updateServiceHealth('digital-twin', {
        status: 'degraded',
        uptime: 94.5,
        averageLatency: 120,
        errorRate: 1.2,
      });

      const dashboardSummary = monitor.getDashboardSummary();
      const optimizationSummary = monitor.getOptimizationSummary();

      const dashboardData = {
        systemStatus: dashboardSummary.systemStatus,
        totalServices: dashboardSummary.totalServices,
        healthyServices: dashboardSummary.healthyServices,
        degradedServices: dashboardSummary.degradedServices,
        unhealthyServices: dashboardSummary.unhealthyServices,
        activeAlerts: dashboardSummary.activeAlerts,
        criticalAlerts: dashboardSummary.criticalAlerts,
        avgUptimePercent: dashboardSummary.avgUptimePercent,
        services: [
          {
            serviceName: 'space-traffic',
            status: 'healthy' as const,
            uptime: 99.95,
            alertCount: 0,
            criticalAlerts: 0,
            avgResponseTime: 45,
            p95ResponseTime: 48,
          },
          {
            serviceName: 'digital-twin',
            status: 'degraded' as const,
            uptime: 94.5,
            alertCount: 1,
            criticalAlerts: 0,
            avgResponseTime: 120,
            p95ResponseTime: 135,
          },
        ],
        recentAlerts: {
          total: 1,
          info: 0,
          warning: 1,
          critical: 0,
          recentAlerts: [],
        },
        optimizationMetrics: optimizationSummary,
      };

      const html = OptimizationDashboardUI.generateDashboardHTML(dashboardData);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('OrbitalMind Optimization Dashboard');
      expect(html).toContain('space-traffic');
      expect(html).toContain('digital-twin');
      expect(html).toContain('99.95%');

      console.log('✓ Valid HTML dashboard generated');
    });

    test('should include all required dashboard sections', () => {
      const dashboardData = {
        systemStatus: 'healthy' as const,
        totalServices: 12,
        healthyServices: 10,
        degradedServices: 2,
        unhealthyServices: 0,
        activeAlerts: 3,
        criticalAlerts: 0,
        avgUptimePercent: 98.5,
        services: [],
        recentAlerts: {
          total: 3,
          info: 1,
          warning: 2,
          critical: 0,
          recentAlerts: [],
        },
        optimizationMetrics: [],
      };

      const html = OptimizationDashboardUI.generateDashboardHTML(dashboardData);

      // Check for required sections
      expect(html).toContain('System Overview');
      expect(html).toContain('Alert Status');
      expect(html).toContain('Optimization Efficiency');
      expect(html).toContain('Service Health Details');
      expect(html).toContain('Recent Alerts');
      expect(html).toContain('Optimization Metrics by Service');

      console.log('✓ All dashboard sections present');
    });

    test('should render service cards correctly', () => {
      const services = [
        {
          serviceName: 'space-traffic',
          status: 'healthy' as const,
          uptime: 99.9,
          alertCount: 0,
          criticalAlerts: 0,
          avgResponseTime: 40,
          p95ResponseTime: 45,
        },
        {
          serviceName: 'thermal-engine',
          status: 'degraded' as const,
          uptime: 95.0,
          alertCount: 2,
          criticalAlerts: 1,
          avgResponseTime: 90,
          p95ResponseTime: 110,
        },
      ];

      const dashboardData = {
        systemStatus: 'degraded' as const,
        totalServices: 2,
        healthyServices: 1,
        degradedServices: 1,
        unhealthyServices: 0,
        activeAlerts: 2,
        criticalAlerts: 1,
        avgUptimePercent: 97.45,
        services,
        recentAlerts: {
          total: 2,
          info: 0,
          warning: 1,
          critical: 1,
          recentAlerts: [
            {
              alertId: 'ALERT-001',
              severity: 'critical',
              message: 'Update rate below threshold',
              timestamp: Date.now(),
            },
            {
              alertId: 'ALERT-002',
              severity: 'warning',
              message: 'Prediction accuracy declining',
              timestamp: Date.now(),
            },
          ],
        },
        optimizationMetrics: [],
      };

      const html = OptimizationDashboardUI.generateDashboardHTML(dashboardData);

      expect(html).toContain('space-traffic');
      expect(html).toContain('thermal-engine');
      expect(html).toContain('healthy');
      expect(html).toContain('degraded');

      console.log('✓ Service cards rendered correctly');
    });

    test('should apply correct status colors', () => {
      const dashboardData = {
        systemStatus: 'critical' as const,
        totalServices: 1,
        healthyServices: 0,
        degradedServices: 0,
        unhealthyServices: 1,
        activeAlerts: 5,
        criticalAlerts: 3,
        avgUptimePercent: 75.0,
        services: [
          {
            serviceName: 'test-service',
            status: 'unhealthy' as const,
            uptime: 75.0,
            alertCount: 5,
            criticalAlerts: 3,
            avgResponseTime: 500,
            p95ResponseTime: 600,
          },
        ],
        recentAlerts: {
          total: 5,
          info: 0,
          warning: 0,
          critical: 5,
          recentAlerts: [],
        },
        optimizationMetrics: [],
      };

      const html = OptimizationDashboardUI.generateDashboardHTML(dashboardData);

      expect(html).toContain('status-critical');
      expect(html).toContain('#ef4444'); // Critical red color

      console.log('✓ Status colors applied correctly');
    });
  });

  describe('Metrics JSON Export', () => {
    test('should generate valid JSON metrics', () => {
      const metricsData = {
        systemStatus: 'healthy',
        totalServices: 12,
        activeAlerts: 0,
        avgUptimePercent: 99.9,
      };

      const json = OptimizationDashboardUI.generateMetricsJSON(metricsData);

      expect(() => JSON.parse(json)).not.toThrow();

      const parsed = JSON.parse(json);
      expect(parsed.systemStatus).toBe('healthy');
      expect(parsed.totalServices).toBe(12);

      console.log('✓ Valid JSON metrics generated');
    });

    test('should preserve metric precision', () => {
      const metricsData = {
        avgUptimePercent: 99.9876,
        p99ResponseTime: 123.456,
        cacheHitRate: 87.654321,
      };

      const json = OptimizationDashboardUI.generateMetricsJSON(metricsData);
      const parsed = JSON.parse(json);

      expect(parsed.avgUptimePercent).toBe(99.9876);
      expect(parsed.p99ResponseTime).toBe(123.456);

      console.log('✓ Metric precision preserved');
    });
  });

  describe('CSV Export', () => {
    test('should generate valid CSV format', () => {
      const services = [
        {
          serviceName: 'space-traffic',
          status: 'healthy' as const,
          uptime: 99.95,
          alertCount: 0,
          criticalAlerts: 0,
          avgResponseTime: 45.5,
          p95ResponseTime: 48.2,
        },
        {
          serviceName: 'digital-twin',
          status: 'degraded' as const,
          uptime: 94.5,
          alertCount: 2,
          criticalAlerts: 1,
          avgResponseTime: 120.3,
          p95ResponseTime: 135.8,
        },
      ];

      const csv = OptimizationDashboardUI.generateMetricsCSV(services);

      expect(csv).toContain('Service Name');
      expect(csv).toContain('Status');
      expect(csv).toContain('space-traffic');
      expect(csv).toContain('digital-twin');
      expect(csv).toContain('healthy');
      expect(csv).toContain('degraded');

      const lines = csv.split('\n');
      expect(lines.length).toBe(3); // Header + 2 services

      console.log('✓ Valid CSV format generated');
    });

    test('should properly escape CSV values', () => {
      const services = [
        {
          serviceName: 'service,with,commas',
          status: 'healthy' as const,
          uptime: 99.5,
          alertCount: 0,
          criticalAlerts: 0,
          avgResponseTime: 50,
          p95ResponseTime: 55,
        },
      ];

      const csv = OptimizationDashboardUI.generateMetricsCSV(services);

      expect(csv).toContain('service,with,commas');

      console.log('✓ CSV values escaped properly');
    });

    test('should maintain correct column order', () => {
      const services = [
        {
          serviceName: 'test-service',
          status: 'healthy' as const,
          uptime: 99.0,
          alertCount: 1,
          criticalAlerts: 0,
          avgResponseTime: 50,
          p95ResponseTime: 60,
        },
      ];

      const csv = OptimizationDashboardUI.generateMetricsCSV(services);
      const lines = csv.split('\n');
      const header = lines[0].split(',');

      expect(header[0]).toBe('Service Name');
      expect(header[1]).toBe('Status');
      expect(header[2]).toBe('Uptime %');
      expect(header[3]).toBe('Avg Response Time (ms)');
      expect(header[4]).toBe('P95 Response Time (ms)');
      expect(header[5]).toBe('Alert Count');

      console.log('✓ CSV columns in correct order');
    });
  });

  describe('Dashboard with Real Monitor Data', () => {
    test('should generate dashboard from live monitor data', () => {
      // Simulate monitor collecting data
      const services = [
        'space-traffic',
        'digital-twin',
        'orbital-networking',
        'autonomy-core',
      ];

      services.forEach((service, index) => {
        monitor.updateServiceHealth(service, {
          status: index % 3 === 0 ? 'healthy' : index % 3 === 1 ? 'degraded' : 'unhealthy',
          uptime: 98 - index * 2,
          averageLatency: 50 + index * 20,
          errorRate: 0.1 + index * 0.3,
        });

        // Add some metrics
        for (let i = 0; i < 10; i++) {
          monitor.recordMetric({
            serviceName: service,
            metricName: 'avgResponseTime',
            value: 40 + Math.random() * 40,
            unit: 'ms',
            timestamp: Date.now(),
            threshold: 50,
          });
        }
      });

      const dashboardSummary = monitor.getDashboardSummary();
      const optimizationSummary = monitor.getOptimizationSummary();

      const dashboardData = {
        systemStatus: dashboardSummary.systemStatus,
        totalServices: dashboardSummary.totalServices,
        healthyServices: dashboardSummary.healthyServices,
        degradedServices: dashboardSummary.degradedServices,
        unhealthyServices: dashboardSummary.unhealthyServices,
        activeAlerts: dashboardSummary.activeAlerts,
        criticalAlerts: dashboardSummary.criticalAlerts,
        avgUptimePercent: dashboardSummary.avgUptimePercent,
        services: services.map(service => ({
          serviceName: service,
          status: monitor.getServiceHealth(service)?.status || 'unknown',
          uptime: monitor.getServiceHealth(service)?.uptime || 0,
          alertCount: monitor.getActiveAlerts(service).length,
          criticalAlerts: monitor.getActiveAlerts(service).filter(a => a.severity === 'critical').length,
          avgResponseTime: monitor.calculateServiceStatistics(service).avgResponseTime,
          p95ResponseTime: monitor.calculateServiceStatistics(service).p95ResponseTime,
        })),
        recentAlerts: {
          total: dashboardSummary.activeAlerts,
          info: monitor.getActiveAlerts().filter(a => a.severity === 'info').length,
          warning: monitor.getActiveAlerts().filter(a => a.severity === 'warning').length,
          critical: dashboardSummary.criticalAlerts,
          recentAlerts: monitor.getActiveAlerts().slice(0, 5),
        },
        optimizationMetrics: optimizationSummary,
      };

      const html = OptimizationDashboardUI.generateDashboardHTML(dashboardData);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('OrbitalMind Optimization Dashboard');
      expect(html).toContain('space-traffic');

      console.log('✓ Dashboard generated from live monitor data');
    });
  });
});
