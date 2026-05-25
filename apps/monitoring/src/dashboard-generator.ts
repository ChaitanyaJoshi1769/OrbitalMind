/**
 * OrbitalMind Optimization Dashboard Generator
 *
 * Generates sample dashboard HTML with realistic optimization metrics
 * Can be used to create and save dashboard files for visualization
 */

import OptimizationMonitor from './optimization-monitor';
import OptimizationDashboardUI from './dashboard-ui';
import fs from 'fs';
import path from 'path';

/**
 * Dashboard generator with sample data simulation
 */
export class DashboardGenerator {
  private monitor: OptimizationMonitor;

  constructor() {
    this.monitor = new OptimizationMonitor();
  }

  /**
   * Populate monitor with realistic sample data
   */
  generateSampleData(): void {
    const services = [
      'space-traffic',
      'digital-twin',
      'orbital-networking',
      'autonomy-core',
      'thermal-engine',
      'radiation-runtime',
      'inference-runtime',
      'edge-compute',
      'control-plane',
      'federation-hub',
      'science-ops',
      'blockchain',
    ];

    // Simulate healthy services
    const healthyServices = services.slice(0, 8);
    healthyServices.forEach((service, index) => {
      this.monitor.updateServiceHealth(service, {
        status: 'healthy',
        uptime: 99.5 + Math.random() * 0.4,
        averageLatency: 30 + Math.random() * 20,
        errorRate: 0.05 + Math.random() * 0.1,
      });

      // Add performance metrics
      for (let i = 0; i < 20; i++) {
        this.monitor.recordMetric({
          serviceName: service,
          metricName: 'avgResponseTime',
          value: 40 + Math.random() * 30,
          unit: 'ms',
          timestamp: Date.now() - i * 1000,
          threshold: 50,
        });
      }
    });

    // Simulate degraded services
    const degradedServices = services.slice(8, 10);
    degradedServices.forEach((service, index) => {
      this.monitor.updateServiceHealth(service, {
        status: 'degraded',
        uptime: 94.0 + Math.random() * 3.0,
        averageLatency: 80 + Math.random() * 40,
        errorRate: 0.5 + Math.random() * 0.5,
      });

      // Add some metrics that exceed thresholds
      for (let i = 0; i < 15; i++) {
        this.monitor.recordMetric({
          serviceName: service,
          metricName: 'avgResponseTime',
          value: 50 + Math.random() * 50, // May exceed 50ms threshold
          unit: 'ms',
          timestamp: Date.now() - i * 1000,
          threshold: 50,
        });
      }
    });

    // Simulate unhealthy services
    const unhealthyServices = services.slice(10, 12);
    unhealthyServices.forEach((service) => {
      this.monitor.updateServiceHealth(service, {
        status: 'unhealthy',
        uptime: 80.0 + Math.random() * 10.0,
        averageLatency: 200 + Math.random() * 100,
        errorRate: 2.0 + Math.random() * 2.0,
      });

      // Add metrics that significantly exceed thresholds
      for (let i = 0; i < 10; i++) {
        this.monitor.recordMetric({
          serviceName: service,
          metricName: 'avgResponseTime',
          value: 100 + Math.random() * 100, // Well above threshold
          unit: 'ms',
          timestamp: Date.now() - i * 1000,
          threshold: 50,
        });
      }
    });
  }

  /**
   * Generate dashboard HTML with current monitor data
   */
  generateDashboard(): string {
    const dashboardSummary = this.monitor.getDashboardSummary();
    const optimizationSummary = this.monitor.getOptimizationSummary();

    const services = [
      'space-traffic',
      'digital-twin',
      'orbital-networking',
      'autonomy-core',
      'thermal-engine',
      'radiation-runtime',
      'inference-runtime',
      'edge-compute',
      'control-plane',
      'federation-hub',
      'science-ops',
      'blockchain',
    ];

    const dashboardData = {
      systemStatus: dashboardSummary.systemStatus,
      totalServices: dashboardSummary.totalServices,
      healthyServices: dashboardSummary.healthyServices,
      degradedServices: dashboardSummary.degradedServices,
      unhealthyServices: dashboardSummary.unhealthyServices,
      activeAlerts: dashboardSummary.activeAlerts,
      criticalAlerts: dashboardSummary.criticalAlerts,
      avgUptimePercent: dashboardSummary.avgUptimePercent,
      services: services.map(service => {
        const health = this.monitor.getServiceHealth(service);
        const stats = this.monitor.calculateServiceStatistics(service);
        return {
          serviceName: service,
          status: (health?.status || 'unknown') as 'healthy' | 'degraded' | 'unhealthy',
          uptime: health?.uptime || 0,
          alertCount: stats.alertCount,
          criticalAlerts: this.monitor.getActiveAlerts(service).filter(a => a.severity === 'critical').length,
          avgResponseTime: stats.avgResponseTime,
          p95ResponseTime: stats.p95ResponseTime,
        };
      }),
      recentAlerts: {
        total: dashboardSummary.activeAlerts,
        info: this.monitor.getActiveAlerts().filter(a => a.severity === 'info').length,
        warning: this.monitor.getActiveAlerts().filter(a => a.severity === 'warning').length,
        critical: dashboardSummary.criticalAlerts,
        recentAlerts: this.monitor.getActiveAlerts().slice(0, 10),
      },
      optimizationMetrics: optimizationSummary,
    };

    return OptimizationDashboardUI.generateDashboardHTML(dashboardData);
  }

  /**
   * Save dashboard HTML to file
   */
  saveDashboard(filePath?: string): void {
    const outputPath = filePath || path.join(process.cwd(), 'optimization-dashboard.html');
    const html = this.generateDashboard();

    fs.writeFileSync(outputPath, html, 'utf-8');
    console.log(`Dashboard saved to: ${outputPath}`);
  }

  /**
   * Generate and return metrics JSON
   */
  getMetricsJSON(): string {
    const dashboardSummary = this.monitor.getDashboardSummary();
    const optimizationSummary = this.monitor.getOptimizationSummary();

    const metricsData = {
      timestamp: new Date().toISOString(),
      systemStatus: dashboardSummary.systemStatus,
      totalServices: dashboardSummary.totalServices,
      healthyServices: dashboardSummary.healthyServices,
      degradedServices: dashboardSummary.degradedServices,
      unhealthyServices: dashboardSummary.unhealthyServices,
      activeAlerts: dashboardSummary.activeAlerts,
      criticalAlerts: dashboardSummary.criticalAlerts,
      avgUptimePercent: dashboardSummary.avgUptimePercent,
      optimizationMetrics: optimizationSummary,
    };

    return OptimizationDashboardUI.generateMetricsJSON(metricsData);
  }

  /**
   * Print dashboard summary to console
   */
  printSummary(): void {
    const summary = this.monitor.getDashboardSummary();
    const optimization = this.monitor.getOptimizationSummary();

    console.log(`
╔════════════════════════════════════════════════════════════╗
║     OrbitalMind Optimization Dashboard Summary             ║
╚════════════════════════════════════════════════════════════╝

📊 System Status: ${summary.systemStatus.toUpperCase()}
   ├─ Total Services: ${summary.totalServices}
   ├─ Healthy: ${summary.healthyServices}
   ├─ Degraded: ${summary.degradedServices}
   ├─ Unhealthy: ${summary.unhealthyServices}
   ├─ Average Uptime: ${summary.avgUptimePercent.toFixed(2)}%
   └─ Active Alerts: ${summary.activeAlerts} (${summary.criticalAlerts} critical)

🚀 Optimization Overview:
   ├─ Total Services Optimized: ${optimization.length}
   ├─ Optimization Classes: 9
   └─ Total Performance Improvements:
      ├─ Collision Detection: 10-100x
      ├─ Orbital Propagation: 10x
      ├─ Routing: 10x
      ├─ Spectral Analysis: <50ms
      ├─ Gradient Compression: 4x
      ├─ Error Correction: 10x
      ├─ Formation Control: ~5x
      ├─ Thermal Control: ~8x
      └─ Task Allocation: ~3x

🔔 Alert Summary:
   ├─ Total Alerts: ${summary.activeAlerts}
   ├─ Critical: ${summary.criticalAlerts}
   ├─ Warnings: ${this.monitor.getActiveAlerts().filter(a => a.severity === 'warning').length}
   └─ Informational: ${this.monitor.getActiveAlerts().filter(a => a.severity === 'info').length}

📈 Service Distribution:
   ${optimization.map(s => `├─ ${s.serviceName}: ${s.status} (${s.metricsTracked} metrics)`).join('\n   ')}

Generated: ${new Date().toISOString()}
    `);
  }
}

/**
 * Example usage and CLI interface
 */
if (require.main === module) {
  const generator = new DashboardGenerator();

  console.log('Generating sample optimization data...');
  generator.generateSampleData();

  console.log('Displaying dashboard summary...\n');
  generator.printSummary();

  console.log('\nSaving dashboard to file...');
  const dashboardPath = process.env.DASHBOARD_OUTPUT || 'optimization-dashboard.html';
  generator.saveDashboard(dashboardPath);

  console.log('\nMetrics JSON:');
  console.log(generator.getMetricsJSON());
}

export default DashboardGenerator;
