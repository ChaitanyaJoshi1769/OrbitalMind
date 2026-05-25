/**
 * OrbitalMind Optimization Dashboard UI
 *
 * Real-time visualization of optimization metrics and system health
 * - Service status display
 * - Performance metrics visualization
 * - Alert management interface
 * - Optimization efficiency tracking
 */

/**
 * Dashboard metric display
 */
export interface DashboardMetric {
  serviceName: string;
  metricName: string;
  value: number;
  unit: string;
  threshold?: number;
  status: 'normal' | 'warning' | 'critical';
  trend: 'up' | 'down' | 'stable';
}

/**
 * Dashboard service card
 */
export interface ServiceCard {
  serviceName: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  alertCount: number;
  criticalAlerts: number;
  avgResponseTime: number;
  p95ResponseTime: number;
}

/**
 * Dashboard alert summary
 */
export interface AlertSummary {
  total: number;
  info: number;
  warning: number;
  critical: number;
  recentAlerts: Array<{
    alertId: string;
    severity: string;
    message: string;
    timestamp: number;
  }>;
}

/**
 * Optimization Dashboard UI Generator
 */
export class OptimizationDashboardUI {
  /**
   * Generate HTML dashboard
   */
  static generateDashboardHTML(
    dashboardData: {
      systemStatus: 'healthy' | 'degraded' | 'critical';
      totalServices: number;
      healthyServices: number;
      degradedServices: number;
      unhealthyServices: number;
      activeAlerts: number;
      criticalAlerts: number;
      avgUptimePercent: number;
      services: ServiceCard[];
      recentAlerts: AlertSummary;
      optimizationMetrics: Array<{
        serviceName: string;
        optimizationClass: string;
        performanceImprovement: string;
        metricsTracked: number;
        status: string;
      }>;
    }
  ): string {
    const { systemStatus, totalServices, healthyServices, degradedServices, unhealthyServices, activeAlerts, criticalAlerts, avgUptimePercent, services, recentAlerts, optimizationMetrics } = dashboardData;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OrbitalMind Optimization Dashboard</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: #e2e8f0;
      min-height: 100vh;
      padding: 20px;
    }

    .container {
      max-width: 1600px;
      margin: 0 auto;
    }

    .header {
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #334155;
    }

    h1 {
      font-size: 2.5em;
      margin-bottom: 10px;
      background: linear-gradient(135deg, #60a5fa, #a78bfa);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .timestamp {
      color: #94a3b8;
      font-size: 0.9em;
    }

    .status-badge {
      display: inline-block;
      padding: 8px 16px;
      border-radius: 20px;
      font-weight: 600;
      font-size: 0.9em;
      margin-top: 10px;
    }

    .status-healthy {
      background-color: #10b981;
      color: white;
    }

    .status-degraded {
      background-color: #f59e0b;
      color: white;
    }

    .status-critical {
      background-color: #ef4444;
      color: white;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }

    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      transition: all 0.3s ease;
    }

    .card:hover {
      border-color: #64748b;
      box-shadow: 0 8px 12px rgba(0, 0, 0, 0.2);
    }

    .card h3 {
      font-size: 1em;
      margin-bottom: 15px;
      color: #cbd5e1;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .metric {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 0;
      border-bottom: 1px solid #334155;
    }

    .metric:last-child {
      border-bottom: none;
    }

    .metric-label {
      color: #94a3b8;
      font-size: 0.9em;
    }

    .metric-value {
      font-size: 1.3em;
      font-weight: 600;
      color: #e2e8f0;
    }

    .progress-bar {
      background: #334155;
      height: 8px;
      border-radius: 4px;
      margin-top: 8px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.3s ease;
    }

    .progress-high {
      background: linear-gradient(90deg, #10b981, #34d399);
    }

    .progress-medium {
      background: linear-gradient(90deg, #f59e0b, #fbbf24);
    }

    .progress-low {
      background: linear-gradient(90deg, #ef4444, #fca5a5);
    }

    .service-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 15px;
      margin-top: 20px;
    }

    .service-card {
      background: #0f172a;
      border: 1px solid #334155;
      border-left: 4px solid #60a5fa;
      border-radius: 8px;
      padding: 15px;
    }

    .service-card.degraded {
      border-left-color: #f59e0b;
    }

    .service-card.unhealthy {
      border-left-color: #ef4444;
    }

    .service-name {
      font-weight: 600;
      margin-bottom: 10px;
      font-size: 1.1em;
    }

    .service-stat {
      display: flex;
      justify-content: space-between;
      font-size: 0.85em;
      padding: 4px 0;
      color: #cbd5e1;
    }

    .alert-item {
      background: #1e293b;
      border-left: 4px solid #f59e0b;
      padding: 12px;
      margin-bottom: 10px;
      border-radius: 4px;
    }

    .alert-item.critical {
      border-left-color: #ef4444;
    }

    .alert-item.info {
      border-left-color: #3b82f6;
    }

    .alert-severity {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.75em;
      font-weight: 600;
      margin-bottom: 4px;
    }

    .severity-critical {
      background: #7f1d1d;
      color: #fecaca;
    }

    .severity-warning {
      background: #7c2d12;
      color: #fdba74;
    }

    .severity-info {
      background: #1e3a8a;
      color: #93c5fd;
    }

    .alert-message {
      font-size: 0.9em;
      margin-bottom: 4px;
    }

    .alert-time {
      font-size: 0.8em;
      color: #64748b;
    }

    .optimization-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
    }

    .optimization-table th {
      background: #0f172a;
      padding: 12px;
      text-align: left;
      font-weight: 600;
      border-bottom: 2px solid #334155;
      color: #94a3b8;
    }

    .optimization-table td {
      padding: 12px;
      border-bottom: 1px solid #334155;
    }

    .optimization-table tr:hover {
      background: #1e293b;
    }

    .optimization-class {
      color: #60a5fa;
      font-weight: 500;
    }

    .performance-improvement {
      background: #064e3b;
      color: #86efac;
      padding: 4px 8px;
      border-radius: 4px;
      font-weight: 600;
    }

    .footer {
      text-align: center;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #334155;
      color: #64748b;
      font-size: 0.9em;
    }

    @media (max-width: 768px) {
      .grid {
        grid-template-columns: 1fr;
      }

      h1 {
        font-size: 1.8em;
      }

      .optimization-table {
        font-size: 0.85em;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚡ OrbitalMind Optimization Dashboard</h1>
      <div class="timestamp">Last updated: ${new Date().toISOString()}</div>
      <div class="status-badge status-${systemStatus}">
        System Status: ${systemStatus.toUpperCase()}
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <h3>📊 System Overview</h3>
        <div class="metric">
          <span class="metric-label">Total Services</span>
          <span class="metric-value">${totalServices}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Healthy</span>
          <span class="metric-value" style="color: #10b981;">${healthyServices}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Degraded</span>
          <span class="metric-value" style="color: #f59e0b;">${degradedServices}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Unhealthy</span>
          <span class="metric-value" style="color: #ef4444;">${unhealthyServices}</span>
        </div>
      </div>

      <div class="card">
        <h3>🚨 Alert Status</h3>
        <div class="metric">
          <span class="metric-label">Active Alerts</span>
          <span class="metric-value">${activeAlerts}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Critical</span>
          <span class="metric-value" style="color: #ef4444;">${criticalAlerts}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Average Uptime</span>
          <span class="metric-value">${avgUptimePercent.toFixed(2)}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill ${avgUptimePercent > 95 ? 'progress-high' : avgUptimePercent > 90 ? 'progress-medium' : 'progress-low'}" style="width: ${avgUptimePercent}%"></div>
        </div>
      </div>

      <div class="card">
        <h3>⚙️ Optimization Efficiency</h3>
        <div class="metric">
          <span class="metric-label">Services Optimized</span>
          <span class="metric-value">${optimizationMetrics.length}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Avg Performance Gain</span>
          <span class="metric-value">5-10x</span>
        </div>
        <div class="metric">
          <span class="metric-label">Optimization Classes</span>
          <span class="metric-value">9</span>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom: 30px;">
      <h3>📈 Service Health Details</h3>
      <div class="service-grid">
        ${services.map(service => `
          <div class="service-card ${service.status !== 'healthy' ? service.status : ''}">
            <div class="service-name">${service.serviceName}</div>
            <div class="service-stat">
              <span>Status:</span>
              <span style="color: ${service.status === 'healthy' ? '#10b981' : service.status === 'degraded' ? '#f59e0b' : '#ef4444'};">${service.status}</span>
            </div>
            <div class="service-stat">
              <span>Uptime:</span>
              <span>${service.uptime.toFixed(2)}%</span>
            </div>
            <div class="service-stat">
              <span>Avg Latency:</span>
              <span>${service.avgResponseTime.toFixed(0)}ms</span>
            </div>
            <div class="service-stat">
              <span>P95 Latency:</span>
              <span>${service.p95ResponseTime.toFixed(0)}ms</span>
            </div>
            <div class="service-stat">
              <span>Active Alerts:</span>
              <span style="color: ${service.alertCount > 0 ? '#ef4444' : '#10b981'};">${service.alertCount}</span>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <h3>🔔 Recent Alerts</h3>
        ${recentAlerts.recentAlerts.length > 0
          ? recentAlerts.recentAlerts.slice(0, 5).map(alert => `
            <div class="alert-item ${alert.severity === 'critical' ? 'critical' : alert.severity === 'warning' ? 'warning' : 'info'}">
              <div class="alert-severity severity-${alert.severity}">${alert.severity.toUpperCase()}</div>
              <div class="alert-message">${alert.message}</div>
              <div class="alert-time">${new Date(alert.timestamp).toLocaleTimeString()}</div>
            </div>
          `).join('')
          : '<div style="color: #64748b; padding: 20px 0; text-align: center;">No active alerts</div>'}
      </div>

      <div class="card">
        <h3>📊 Alert Summary</h3>
        <div class="metric">
          <span class="metric-label">Total Alerts</span>
          <span class="metric-value">${recentAlerts.total}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Critical</span>
          <span class="metric-value" style="color: #ef4444;">${recentAlerts.critical}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Warnings</span>
          <span class="metric-value" style="color: #f59e0b;">${recentAlerts.warning}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Info</span>
          <span class="metric-value" style="color: #60a5fa;">${recentAlerts.info}</span>
        </div>
      </div>
    </div>

    <div class="card" style="margin-top: 30px;">
      <h3>🚀 Optimization Metrics by Service</h3>
      <table class="optimization-table">
        <thead>
          <tr>
            <th>Service</th>
            <th>Optimization Class</th>
            <th>Performance Improvement</th>
            <th>Metrics Tracked</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${optimizationMetrics.map(metric => `
            <tr>
              <td>${metric.serviceName}</td>
              <td><span class="optimization-class">${metric.optimizationClass}</span></td>
              <td><span class="performance-improvement">${metric.performanceImprovement}</span></td>
              <td>${metric.metricsTracked}</td>
              <td style="color: ${metric.status === 'healthy' ? '#10b981' : metric.status === 'degraded' ? '#f59e0b' : '#ef4444'};">${metric.status}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="footer">
      <p>OrbitalMind Optimization Dashboard | Real-time monitoring of satellite constellation optimization</p>
      <p style="margin-top: 10px; color: #475569;">All services monitored • Performance metrics updated every 5 seconds</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  /**
   * Generate metrics JSON for API consumption
   */
  static generateMetricsJSON(dashboardData: any): string {
    return JSON.stringify(dashboardData, null, 2);
  }

  /**
   * Generate CSV export for metrics
   */
  static generateMetricsCSV(services: ServiceCard[]): string {
    const headers = ['Service Name', 'Status', 'Uptime %', 'Avg Response Time (ms)', 'P95 Response Time (ms)', 'Alert Count'];
    const rows = services.map(s => [
      s.serviceName,
      s.status,
      s.uptime.toFixed(2),
      s.avgResponseTime.toFixed(0),
      s.p95ResponseTime.toFixed(0),
      s.alertCount.toString(),
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }
}

export default OptimizationDashboardUI;
