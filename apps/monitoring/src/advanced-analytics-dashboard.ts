/**
 * OrbitalMind Advanced Analytics Dashboard
 *
 * Real-time analytics with comprehensive visualizations,
 * predictive insights, and actionable intelligence
 */

import pino from 'pino';

/**
 * Dashboard metric
 */
export interface DashboardMetric {
  name: string;
  serviceName: string;
  currentValue: number;
  trend: 'up' | 'down' | 'stable';
  trendPercentage: number;
  threshold: number;
  status: 'healthy' | 'warning' | 'critical';
  sparklineData: number[];
  timestamp: number;
}

/**
 * Dashboard alert
 */
export interface DashboardAlert {
  id: string;
  serviceName: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  timestamp: number;
  duration: number; // milliseconds
  escalationLevel?: string;
  relatedIncidents: string[];
}

/**
 * Service health card
 */
export interface ServiceHealthCard {
  serviceName: string;
  status: 'healthy' | 'degraded' | 'critical';
  uptime: number; // percentage
  avgLatency: number; // ms
  errorRate: number; // percentage
  throughput: number; // requests/second
  activeAlerts: number;
  metrics: DashboardMetric[];
  sparklineData: {
    latency: number[];
    errorRate: number[];
    uptime: number[];
  };
  lastUpdated: number;
}

/**
 * Real-time event
 */
export interface RealtimeEvent {
  type: 'alert' | 'escalation' | 'incident' | 'metric' | 'prediction';
  serviceName: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  timestamp: number;
  data?: any;
}

/**
 * Performance trend
 */
export interface PerformanceTrend {
  serviceName: string;
  metric: string;
  trendDirection: 'improving' | 'degrading' | 'stable';
  percentageChange: number;
  forecastedValue: number;
  confidenceLevel: number; // 0-1
  dataPoints: Array<{ timestamp: number; value: number }>;
}

/**
 * Advanced Analytics Dashboard
 */
export class AdvancedAnalyticsDashboard {
  private logger = pino();
  private metrics: Map<string, DashboardMetric> = new Map();
  private alerts: Map<string, DashboardAlert> = new Map();
  private serviceCards: Map<string, ServiceHealthCard> = new Map();
  private realtimeEvents: RealtimeEvent[] = [];
  private performanceTrends: Map<string, PerformanceTrend> = new Map();
  private eventMaxSize = 1000; // Keep last 1000 events
  private subscribers: Array<(event: RealtimeEvent) => void> = [];

  constructor() {
    this.setupDefaultServices();
  }

  /**
   * Set up default services
   */
  private setupDefaultServices(): void {
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

    for (const service of services) {
      this.serviceCards.set(service, {
        serviceName: service,
        status: 'healthy',
        uptime: 99.9,
        avgLatency: 50,
        errorRate: 0.1,
        throughput: 1000,
        activeAlerts: 0,
        metrics: [],
        sparklineData: {
          latency: Array(24).fill(50).map((v) => v + Math.random() * 10),
          errorRate: Array(24).fill(0.1).map((v) => v + Math.random() * 0.05),
          uptime: Array(24).fill(99.9).map((v) => v - Math.random() * 0.1),
        },
        lastUpdated: Date.now(),
      });
    }

    this.logger.info('Default services configured');
  }

  /**
   * Record metric
   */
  recordMetric(metric: DashboardMetric): void {
    const key = `${metric.serviceName}:${metric.name}`;
    this.metrics.set(key, metric);

    // Update service card
    const serviceCard = this.serviceCards.get(metric.serviceName);
    if (serviceCard) {
      serviceCard.metrics.push(metric);
      if (serviceCard.metrics.length > 50) {
        serviceCard.metrics = serviceCard.metrics.slice(-50);
      }
      serviceCard.lastUpdated = Date.now();

      // Update service status based on metrics
      this.updateServiceStatus(metric.serviceName);
    }

    // Emit realtime event
    this.emitRealtimeEvent({
      type: 'metric',
      serviceName: metric.serviceName,
      severity: metric.status === 'critical' ? 'critical' : metric.status === 'warning' ? 'warning' : 'info',
      message: `${metric.name}: ${metric.currentValue}`,
      timestamp: metric.timestamp,
      data: metric,
    });
  }

  /**
   * Record alert
   */
  recordAlert(alert: DashboardAlert): void {
    this.alerts.set(alert.id, alert);

    // Update service card alert count
    const serviceCard = this.serviceCards.get(alert.serviceName);
    if (serviceCard) {
      serviceCard.activeAlerts = Array.from(this.alerts.values()).filter(
        (a) => a.serviceName === alert.serviceName && Date.now() - a.timestamp < 3600000
      ).length;
    }

    // Emit realtime event
    this.emitRealtimeEvent({
      type: 'alert',
      serviceName: alert.serviceName,
      severity: alert.severity,
      message: alert.message,
      timestamp: alert.timestamp,
      data: alert,
    });
  }

  /**
   * Record prediction event
   */
  recordPrediction(
    serviceName: string,
    metric: string,
    probability: number,
    message: string
  ): void {
    this.emitRealtimeEvent({
      type: 'prediction',
      serviceName,
      severity: probability > 0.8 ? 'critical' : probability > 0.5 ? 'warning' : 'info',
      message: `${metric}: ${(probability * 100).toFixed(1)}% violation probability - ${message}`,
      timestamp: Date.now(),
      data: { metric, probability },
    });
  }

  /**
   * Subscribe to realtime events
   */
  subscribe(callback: (event: RealtimeEvent) => void): () => void {
    this.subscribers.push(callback);

    // Return unsubscribe function
    return () => {
      this.subscribers = this.subscribers.filter((s) => s !== callback);
    };
  }

  /**
   * Emit realtime event
   */
  private emitRealtimeEvent(event: RealtimeEvent): void {
    this.realtimeEvents.push(event);

    // Keep only last N events
    if (this.realtimeEvents.length > this.eventMaxSize) {
      this.realtimeEvents = this.realtimeEvents.slice(-this.eventMaxSize);
    }

    // Notify all subscribers
    for (const subscriber of this.subscribers) {
      try {
        subscriber(event);
      } catch (error) {
        this.logger.error({ error }, 'Subscriber error');
      }
    }
  }

  /**
   * Update service status based on metrics
   */
  private updateServiceStatus(serviceName: string): void {
    const serviceCard = this.serviceCards.get(serviceName);
    if (!serviceCard) {
      return;
    }

    const criticalMetrics = serviceCard.metrics.filter((m) => m.status === 'critical');
    const warningMetrics = serviceCard.metrics.filter((m) => m.status === 'warning');

    if (criticalMetrics.length > 0) {
      serviceCard.status = 'critical';
    } else if (warningMetrics.length > 0) {
      serviceCard.status = 'degraded';
    } else {
      serviceCard.status = 'healthy';
    }
  }

  /**
   * Get service health card
   */
  getServiceCard(serviceName: string): ServiceHealthCard | undefined {
    return this.serviceCards.get(serviceName);
  }

  /**
   * Get all service cards
   */
  getAllServiceCards(): ServiceHealthCard[] {
    return Array.from(this.serviceCards.values());
  }

  /**
   * Get dashboard summary
   */
  getDashboardSummary(): {
    overallStatus: 'healthy' | 'degraded' | 'critical';
    healthyServices: number;
    degradedServices: number;
    criticalServices: number;
    totalAlerts: number;
    criticalAlerts: number;
    warningAlerts: number;
    systemUptime: number;
    avgResponseTime: number;
    avgErrorRate: number;
  } {
    const cards = this.getAllServiceCards();

    const healthyCount = cards.filter((c) => c.status === 'healthy').length;
    const degradedCount = cards.filter((c) => c.status === 'degraded').length;
    const criticalCount = cards.filter((c) => c.status === 'critical').length;

    const activeAlerts = Array.from(this.alerts.values()).filter(
      (a) => Date.now() - a.timestamp < 3600000
    );
    const criticalAlerts = activeAlerts.filter((a) => a.severity === 'critical').length;
    const warningAlerts = activeAlerts.filter((a) => a.severity === 'warning').length;

    const avgUptime = cards.reduce((sum, c) => sum + c.uptime, 0) / cards.length;
    const avgLatency = cards.reduce((sum, c) => sum + c.avgLatency, 0) / cards.length;
    const avgErrorRate = cards.reduce((sum, c) => sum + c.errorRate, 0) / cards.length;

    const overallStatus =
      criticalCount > 0 ? 'critical' : degradedCount > 0 ? 'degraded' : 'healthy';

    return {
      overallStatus,
      healthyServices: healthyCount,
      degradedServices: degradedCount,
      criticalServices: criticalCount,
      totalAlerts: activeAlerts.length,
      criticalAlerts,
      warningAlerts,
      systemUptime: avgUptime,
      avgResponseTime: avgLatency,
      avgErrorRate,
    };
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(limit: number = 10): DashboardAlert[] {
    return Array.from(this.alerts.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get alerts by service
   */
  getAlertsByService(serviceName: string): DashboardAlert[] {
    return Array.from(this.alerts.values())
      .filter((a) => a.serviceName === serviceName)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get critical alerts
   */
  getCriticalAlerts(): DashboardAlert[] {
    return Array.from(this.alerts.values())
      .filter((a) => a.severity === 'critical')
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get realtime event stream
   */
  getRecentEvents(limit: number = 100): RealtimeEvent[] {
    return this.realtimeEvents.slice(-limit);
  }

  /**
   * Get events by type
   */
  getEventsByType(type: RealtimeEvent['type'], limit: number = 50): RealtimeEvent[] {
    return this.realtimeEvents
      .filter((e) => e.type === type)
      .slice(-limit);
  }

  /**
   * Get service metrics
   */
  getServiceMetrics(serviceName: string): DashboardMetric[] {
    return Array.from(this.metrics.values()).filter(
      (m) => m.serviceName === serviceName
    );
  }

  /**
   * Record performance trend
   */
  recordPerformanceTrend(trend: PerformanceTrend): void {
    const key = `${trend.serviceName}:${trend.metric}`;
    this.performanceTrends.set(key, trend);
  }

  /**
   * Get performance trends
   */
  getPerformanceTrends(serviceName?: string): PerformanceTrend[] {
    const trends = Array.from(this.performanceTrends.values());
    return serviceName
      ? trends.filter((t) => t.serviceName === serviceName)
      : trends;
  }

  /**
   * Get trend by service and metric
   */
  getTrend(serviceName: string, metric: string): PerformanceTrend | undefined {
    const key = `${serviceName}:${metric}`;
    return this.performanceTrends.get(key);
  }

  /**
   * Generate dashboard HTML
   */
  generateDashboardHTML(): string {
    const summary = this.getDashboardSummary();
    const serviceCards = this.getAllServiceCards();
    const recentAlerts = this.getRecentAlerts(10);

    const statusColor =
      summary.overallStatus === 'critical'
        ? '#ff4444'
        : summary.overallStatus === 'degraded'
          ? '#ffaa00'
          : '#44aa44';

    return `
<!DOCTYPE html>
<html>
<head>
    <title>OrbitalMind Advanced Analytics Dashboard</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f0f0f; color: #eee; }
        .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; border-bottom: 1px solid #333; padding-bottom: 20px; }
        .header h1 { font-size: 24px; }
        .status-badge { padding: 8px 16px; border-radius: 4px; background: ${statusColor}; font-weight: bold; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 30px; }
        .summary-card { background: #1a1a1a; padding: 15px; border-radius: 4px; border-left: 3px solid #4a90e2; }
        .summary-card .value { font-size: 28px; font-weight: bold; color: #4a90e2; }
        .summary-card .label { font-size: 12px; color: #999; text-transform: uppercase; margin-top: 5px; }
        .services-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 15px; margin-bottom: 30px; }
        .service-card { background: #1a1a1a; padding: 15px; border-radius: 4px; border-top: 3px solid #4a90e2; }
        .service-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .service-name { font-weight: bold; font-size: 14px; }
        .service-status { font-size: 12px; padding: 4px 8px; border-radius: 3px; }
        .healthy { background: #44aa44; color: #fff; }
        .degraded { background: #ffaa00; color: #000; }
        .critical { background: #ff4444; color: #fff; }
        .metric-row { display: flex; justify-content: space-between; font-size: 12px; padding: 5px 0; }
        .metric-label { color: #999; }
        .metric-value { font-weight: bold; }
        .alerts-section { background: #1a1a1a; padding: 15px; border-radius: 4px; }
        .alerts-section h3 { margin-bottom: 10px; }
        .alert-item { padding: 10px; border-left: 3px solid #ff4444; margin-bottom: 10px; background: #222; border-radius: 2px; }
        .alert-critical { border-left-color: #ff4444; }
        .alert-warning { border-left-color: #ffaa00; }
        .alert-info { border-left-color: #4a90e2; }
        .alert-time { font-size: 11px; color: #999; }
        .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>OrbitalMind Advanced Analytics</h1>
            <div class="status-badge">${summary.overallStatus.toUpperCase()}</div>
        </div>

        <div class="summary-grid">
            <div class="summary-card">
                <div class="value">${summary.healthyServices}</div>
                <div class="label">Healthy Services</div>
            </div>
            <div class="summary-card">
                <div class="value">${summary.degradedServices}</div>
                <div class="label">Degraded Services</div>
            </div>
            <div class="summary-card">
                <div class="value">${summary.criticalServices}</div>
                <div class="label">Critical Services</div>
            </div>
            <div class="summary-card">
                <div class="value">${summary.totalAlerts}</div>
                <div class="label">Active Alerts</div>
            </div>
            <div class="summary-card">
                <div class="value">${summary.systemUptime.toFixed(2)}%</div>
                <div class="label">System Uptime</div>
            </div>
            <div class="summary-card">
                <div class="value">${summary.avgResponseTime.toFixed(1)}ms</div>
                <div class="label">Avg Response Time</div>
            </div>
        </div>

        <h2 style="margin-bottom: 15px;">Service Status</h2>
        <div class="services-grid">
            ${serviceCards
              .map(
                (card) => `
            <div class="service-card">
                <div class="service-header">
                    <div class="service-name">${card.serviceName}</div>
                    <div class="service-status ${card.status}">${card.status}</div>
                </div>
                <div class="metric-row">
                    <span class="metric-label">Uptime</span>
                    <span class="metric-value">${card.uptime.toFixed(2)}%</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">Latency</span>
                    <span class="metric-value">${card.avgLatency.toFixed(1)}ms</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">Error Rate</span>
                    <span class="metric-value">${card.errorRate.toFixed(2)}%</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">Throughput</span>
                    <span class="metric-value">${card.throughput.toFixed(0)} req/s</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">Active Alerts</span>
                    <span class="metric-value">${card.activeAlerts}</span>
                </div>
            </div>
            `
              )
              .join('')}
        </div>

        <h2 style="margin-bottom: 15px;">Recent Alerts</h2>
        <div class="alerts-section">
            ${
              recentAlerts.length === 0
                ? '<p style="color: #999;">No active alerts</p>'
                : recentAlerts
                    .map(
                      (alert) => `
            <div class="alert-item alert-${alert.severity}">
                <div style="font-weight: bold;">${alert.serviceName}: ${alert.message}</div>
                <div class="alert-time">${new Date(alert.timestamp).toLocaleString()}</div>
            </div>
            `
                    )
                    .join('')
            }
        </div>

        <div class="footer">
            <p>Generated at ${new Date().toLocaleString()} | OrbitalMind Advanced Analytics Dashboard</p>
        </div>
    </div>
</body>
</html>
    `;
  }

  /**
   * Export dashboard data as JSON
   */
  exportDashboardData(): string {
    return JSON.stringify(
      {
        timestamp: Date.now(),
        summary: this.getDashboardSummary(),
        serviceCards: this.getAllServiceCards(),
        recentAlerts: this.getRecentAlerts(100),
        performanceTrends: Array.from(this.performanceTrends.values()),
        recentEvents: this.getRecentEvents(200),
      },
      null,
      2
    );
  }
}

export default AdvancedAnalyticsDashboard;
