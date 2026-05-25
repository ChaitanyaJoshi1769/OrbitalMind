/**
 * OrbitalMind Monitoring API Server
 *
 * HTTP REST API for metric collection, monitoring, and dashboard access
 * Provides endpoints for services to report metrics and retrieve monitoring data
 */

import express, { Request, Response } from 'express';
import pino from 'pino';
import OptimizationMonitor from './optimization-monitor';
import OptimizationDashboardUI from './dashboard-ui';
import { MetricsCollector, MetricBatch } from './metrics-collector';

/**
 * Monitoring API Server
 */
export class MonitoringAPIServer {
  private app: express.Application;
  private logger = pino();
  private monitor: OptimizationMonitor;
  private collectors: Map<string, MetricsCollector> = new Map();
  private port: number;

  constructor(port: number = 3000) {
    this.app = express();
    this.monitor = new OptimizationMonitor();
    this.port = port;
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Setup middleware
   */
  private setupMiddleware(): void {
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ limit: '10mb', extended: true }));

    // Request logging
    this.app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        this.logger.info(
          {
            method: req.method,
            path: req.path,
            status: res.statusCode,
            duration,
          },
          'Request completed'
        );
      });
      next();
    });
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'healthy', timestamp: Date.now() });
    });

    // Metrics endpoints
    this.app.post('/api/metrics/record', (req: Request, res: Response) => {
      this.handleRecordMetric(req, res);
    });

    this.app.post('/api/metrics/batch', (req: Request, res: Response) => {
      this.handleBatchMetrics(req, res);
    });

    this.app.get('/api/metrics/:serviceName', (req: Request, res: Response) => {
      this.handleGetServiceMetrics(req, res);
    });

    // Health endpoints
    this.app.post('/api/health/update', (req: Request, res: Response) => {
      this.handleUpdateServiceHealth(req, res);
    });

    this.app.get('/api/health/:serviceName', (req: Request, res: Response) => {
      this.handleGetServiceHealth(req, res);
    });

    this.app.get('/api/health', (req: Request, res: Response) => {
      this.handleGetAllHealth(req, res);
    });

    // Alert endpoints
    this.app.get('/api/alerts', (req: Request, res: Response) => {
      this.handleGetAlerts(req, res);
    });

    this.app.get('/api/alerts/:serviceName', (req: Request, res: Response) => {
      this.handleGetServiceAlerts(req, res);
    });

    this.app.post('/api/alerts/:alertId/resolve', (req: Request, res: Response) => {
      this.handleResolveAlert(req, res);
    });

    // Dashboard endpoints
    this.app.get('/api/dashboard/summary', (req: Request, res: Response) => {
      this.handleDashboardSummary(req, res);
    });

    this.app.get('/api/dashboard/html', (req: Request, res: Response) => {
      this.handleDashboardHTML(req, res);
    });

    this.app.get('/api/dashboard/metrics.json', (req: Request, res: Response) => {
      this.handleDashboardJSON(req, res);
    });

    this.app.get('/api/dashboard/metrics.csv', (req: Request, res: Response) => {
      this.handleDashboardCSV(req, res);
    });

    // Statistics endpoints
    this.app.get('/api/statistics/:serviceName', (req: Request, res: Response) => {
      this.handleGetStatistics(req, res);
    });

    this.app.get('/api/optimization/summary', (req: Request, res: Response) => {
      this.handleOptimizationSummary(req, res);
    });

    // Error handling
    this.app.use((err: Error, req: Request, res: Response) => {
      this.logger.error({ error: err }, 'Request error');
      res.status(500).json({
        error: 'Internal server error',
        message: err.message,
      });
    });
  }

  /**
   * Handle record metric request
   */
  private handleRecordMetric(req: Request, res: Response): void {
    try {
      const { serviceName, metricName, value, unit, threshold } = req.body;

      if (!serviceName || !metricName || value === undefined) {
        return res.status(400).json({
          error: 'Missing required fields: serviceName, metricName, value',
        });
      }

      this.monitor.recordMetric({
        serviceName,
        metricName,
        value,
        unit: unit || 'value',
        timestamp: Date.now(),
        threshold,
      });

      res.json({
        success: true,
        message: 'Metric recorded',
        metric: { serviceName, metricName, value },
      });
    } catch (error) {
      res.status(400).json({ error: String(error) });
    }
  }

  /**
   * Handle batch metrics request
   */
  private handleBatchMetrics(req: Request, res: Response): void {
    try {
      const { serviceName, metrics } = req.body;

      if (!serviceName || !Array.isArray(metrics)) {
        return res.status(400).json({
          error: 'Missing required fields: serviceName, metrics (array)',
        });
      }

      metrics.forEach((metric: any) => {
        this.monitor.recordMetric({
          serviceName,
          metricName: metric.name,
          value: metric.value,
          unit: metric.unit || 'value',
          timestamp: Date.now(),
          threshold: metric.threshold,
        });
      });

      res.json({
        success: true,
        message: `${metrics.length} metrics recorded`,
        count: metrics.length,
      });
    } catch (error) {
      res.status(400).json({ error: String(error) });
    }
  }

  /**
   * Handle get service metrics
   */
  private handleGetServiceMetrics(req: Request, res: Response): void {
    const { serviceName } = req.params;
    const { metricName } = req.query;

    const metrics = this.monitor.getServiceMetrics(
      serviceName,
      metricName as string
    );

    res.json({
      serviceName,
      metricCount: metrics.length,
      metrics: metrics.slice(-10), // Return last 10
    });
  }

  /**
   * Handle update service health
   */
  private handleUpdateServiceHealth(req: Request, res: Response): void {
    try {
      const { serviceName, status, uptime, averageLatency, errorRate } = req.body;

      if (!serviceName || !status) {
        return res.status(400).json({
          error: 'Missing required fields: serviceName, status',
        });
      }

      this.monitor.updateServiceHealth(serviceName, {
        status: status as 'healthy' | 'degraded' | 'unhealthy',
        uptime: uptime || 99.0,
        averageLatency: averageLatency || 0,
        errorRate: errorRate || 0,
      });

      res.json({
        success: true,
        message: 'Service health updated',
        serviceName,
        status,
      });
    } catch (error) {
      res.status(400).json({ error: String(error) });
    }
  }

  /**
   * Handle get service health
   */
  private handleGetServiceHealth(req: Request, res: Response): void {
    const { serviceName } = req.params;
    const health = this.monitor.getServiceHealth(serviceName);

    if (!health) {
      return res.status(404).json({
        error: 'Service not found',
        serviceName,
      });
    }

    res.json(health);
  }

  /**
   * Handle get all health
   */
  private handleGetAllHealth(req: Request, res: Response): void {
    const health = this.monitor.getAllServiceHealth();
    res.json({
      services: health.length,
      health,
    });
  }

  /**
   * Handle get alerts
   */
  private handleGetAlerts(req: Request, res: Response): void {
    const { serviceName, severity } = req.query;

    let alerts = this.monitor.getActiveAlerts(serviceName as string);

    if (severity) {
      alerts = alerts.filter(a => a.severity === severity);
    }

    res.json({
      alertCount: alerts.length,
      alerts: alerts.slice(-20), // Return last 20
    });
  }

  /**
   * Handle get service alerts
   */
  private handleGetServiceAlerts(req: Request, res: Response): void {
    const { serviceName } = req.params;
    const alerts = this.monitor.getActiveAlerts(serviceName);

    res.json({
      serviceName,
      alertCount: alerts.length,
      alerts,
    });
  }

  /**
   * Handle resolve alert
   */
  private handleResolveAlert(req: Request, res: Response): void {
    const { alertId } = req.params;
    const resolved = this.monitor.resolveAlert(alertId);

    if (!resolved) {
      return res.status(404).json({
        error: 'Alert not found',
        alertId,
      });
    }

    res.json({
      success: true,
      message: 'Alert resolved',
      alertId,
    });
  }

  /**
   * Handle dashboard summary
   */
  private handleDashboardSummary(req: Request, res: Response): void {
    const summary = this.monitor.getDashboardSummary();
    res.json(summary);
  }

  /**
   * Handle dashboard HTML
   */
  private handleDashboardHTML(req: Request, res: Response): void {
    const summary = this.monitor.getDashboardSummary();
    const optimization = this.monitor.getOptimizationSummary();

    const services = optimization.map(s => ({
      serviceName: s.serviceName,
      status: this.monitor.getServiceHealth(s.serviceName)?.status || 'unknown',
      uptime: this.monitor.getServiceHealth(s.serviceName)?.uptime || 0,
      alertCount: this.monitor.getActiveAlerts(s.serviceName).length,
      criticalAlerts: this.monitor
        .getActiveAlerts(s.serviceName)
        .filter(a => a.severity === 'critical').length,
      avgResponseTime: this.monitor.calculateServiceStatistics(s.serviceName).avgResponseTime,
      p95ResponseTime: this.monitor.calculateServiceStatistics(s.serviceName).p95ResponseTime,
    }));

    const dashboardData = {
      systemStatus: summary.systemStatus,
      totalServices: summary.totalServices,
      healthyServices: summary.healthyServices,
      degradedServices: summary.degradedServices,
      unhealthyServices: summary.unhealthyServices,
      activeAlerts: summary.activeAlerts,
      criticalAlerts: summary.criticalAlerts,
      avgUptimePercent: summary.avgUptimePercent,
      services,
      recentAlerts: {
        total: summary.activeAlerts,
        info: this.monitor.getActiveAlerts().filter(a => a.severity === 'info').length,
        warning: this.monitor.getActiveAlerts().filter(a => a.severity === 'warning').length,
        critical: summary.criticalAlerts,
        recentAlerts: this.monitor.getActiveAlerts().slice(0, 10),
      },
      optimizationMetrics: optimization,
    };

    const html = OptimizationDashboardUI.generateDashboardHTML(dashboardData);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  /**
   * Handle dashboard JSON
   */
  private handleDashboardJSON(req: Request, res: Response): void {
    const summary = this.monitor.getDashboardSummary();
    const optimization = this.monitor.getOptimizationSummary();

    const metricsData = {
      timestamp: new Date().toISOString(),
      systemStatus: summary.systemStatus,
      totalServices: summary.totalServices,
      healthyServices: summary.healthyServices,
      degradedServices: summary.degradedServices,
      unhealthyServices: summary.unhealthyServices,
      activeAlerts: summary.activeAlerts,
      criticalAlerts: summary.criticalAlerts,
      avgUptimePercent: summary.avgUptimePercent,
      optimizationMetrics: optimization,
    };

    res.json(metricsData);
  }

  /**
   * Handle dashboard CSV
   */
  private handleDashboardCSV(req: Request, res: Response): void {
    const optimization = this.monitor.getOptimizationSummary();
    const services = optimization.map(s => ({
      serviceName: s.serviceName,
      status: this.monitor.getServiceHealth(s.serviceName)?.status || 'unknown',
      uptime: this.monitor.getServiceHealth(s.serviceName)?.uptime || 0,
      alertCount: this.monitor.getActiveAlerts(s.serviceName).length,
      criticalAlerts: this.monitor
        .getActiveAlerts(s.serviceName)
        .filter(a => a.severity === 'critical').length,
      avgResponseTime: this.monitor.calculateServiceStatistics(s.serviceName).avgResponseTime,
      p95ResponseTime: this.monitor.calculateServiceStatistics(s.serviceName).p95ResponseTime,
    }));

    const csv = OptimizationDashboardUI.generateMetricsCSV(services);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="metrics.csv"');
    res.send(csv);
  }

  /**
   * Handle get statistics
   */
  private handleGetStatistics(req: Request, res: Response): void {
    const { serviceName } = req.params;
    const stats = this.monitor.calculateServiceStatistics(serviceName);

    res.json({
      serviceName,
      statistics: stats,
    });
  }

  /**
   * Handle optimization summary
   */
  private handleOptimizationSummary(req: Request, res: Response): void {
    const summary = this.monitor.getOptimizationSummary();
    res.json({
      servicesOptimized: summary.length,
      services: summary,
    });
  }

  /**
   * Start server
   */
  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(this.port, () => {
        this.logger.info({ port: this.port }, 'Monitoring API server started');
        resolve();
      });
    });
  }

  /**
   * Get monitor instance
   */
  getMonitor(): OptimizationMonitor {
    return this.monitor;
  }

  /**
   * Get or create metrics collector
   */
  getCollector(serviceName: string): MetricsCollector {
    if (!this.collectors.has(serviceName)) {
      const collector = new MetricsCollector(serviceName);
      collector.setFlushCallback((batch: MetricBatch) => {
        batch.metrics.forEach(metric => {
          this.monitor.recordMetric({
            serviceName: batch.serviceName,
            metricName: metric.name,
            value: metric.value,
            unit: metric.unit,
            timestamp: batch.timestamp,
            threshold: metric.threshold,
          });
        });
      });
      this.collectors.set(serviceName, collector);
    }
    return this.collectors.get(serviceName)!;
  }
}

export default MonitoringAPIServer;
