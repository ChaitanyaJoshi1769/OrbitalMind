/**
 * OrbitalMind Optimization Monitoring System
 *
 * Real-time monitoring and alerting for all optimized services
 * - Performance metrics collection
 * - SLA violation detection
 * - Performance regression alerts
 * - Service health tracking
 */

import pino from "pino";

/**
 * Performance metric
 */
export interface PerformanceMetric {
  serviceName: string;
  metricName: string;
  value: number;
  unit: string;
  timestamp: number;
  threshold?: number;
  alert?: boolean;
}

/**
 * Service health status
 */
export interface ServiceHealth {
  serviceName: string;
  status: "healthy" | "degraded" | "unhealthy";
  uptime: number; // percentage
  averageLatency: number; // ms
  errorRate: number; // percentage
  lastChecked: number;
}

/**
 * Performance alert
 */
export interface PerformanceAlert {
  alertId: string;
  serviceName: string;
  metricName: string;
  severity: "info" | "warning" | "critical";
  message: string;
  expectedValue: number;
  actualValue: number;
  timestamp: number;
  resolved: boolean;
}

/**
 * Service optimization metrics tracker
 */
export interface ServiceOptimizationMetrics {
  serviceName: string;
  metrics: Map<string, number[]>; // metric name -> array of values
  avgResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  throughput: number; // operations per second
  errorRate: number;
  lastUpdated: number;
}

/**
 * Optimization Monitor
 */
export class OptimizationMonitor {
  private logger = pino();
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private serviceHealth: Map<string, ServiceHealth> = new Map();
  private alerts: Map<string, PerformanceAlert> = new Map();
  private serviceMetrics: Map<string, ServiceOptimizationMetrics> = new Map();

  // Thresholds for alerting
  private thresholds: Map<string, Map<string, number>> = new Map([
    [
      "space-traffic",
      new Map([
        ["avgResponseTime", 50], // ms
        ["errorRate", 1], // %
      ]),
    ],
    [
      "digital-twin",
      new Map([
        ["avgResponseTime", 100],
        ["cacheHitRate", 70], // minimum
      ]),
    ],
    [
      "orbital-networking",
      new Map([
        ["avgResponseTime", 50],
        ["routingTime", 500],
      ]),
    ],
    [
      "autonomy-core",
      new Map([
        ["convergenceTime", 1000],
        ["errorRate", 2],
      ]),
    ],
    [
      "thermal-engine",
      new Map([
        ["updateRate", 100], // Hz
        ["predictionAccuracy", 85], // % minimum
      ]),
    ],
    [
      "radiation-runtime",
      new Map([
        ["errorCorrectionTime", 50],
        ["blockProcessingRate", 1000],
      ]),
    ],
    [
      "inference-runtime",
      new Map([
        ["compressionRatio", 4], // minimum
        ["inferenceTime", 200],
      ]),
    ],
    [
      "edge-compute",
      new Map([
        ["compressionRatio", 4],
        ["communicationSavings", 75], // % minimum
      ]),
    ],
    [
      "control-plane",
      new Map([
        ["allocationTime", 10], // ms
        ["scalingEfficiency", 90], // % minimum
      ]),
    ],
    [
      "federation-hub",
      new Map([
        ["selectionTime", 5],
        ["handoffSuccessRate", 95], // % minimum
      ]),
    ],
    [
      "science-ops",
      new Map([
        ["spectralAnalysisTime", 50],
        ["targetSelectionTime", 5],
      ]),
    ],
    [
      "blockchain",
      new Map([
        ["queryTime", 10],
        ["cacheHitRate", 80], // % minimum
      ]),
    ],
  ]);

  constructor() {
    this.logger.info("Optimization Monitor initialized with thresholds for 12 services");
  }

  /**
   * Record performance metric
   */
  recordMetric(metric: PerformanceMetric): void {
    const key = `${metric.serviceName}:${metric.metricName}`;

    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }

    // Add alert flag if metric exceeds threshold
    if (metric.threshold && metric.value > metric.threshold) {
      metric.alert = true;
      this.createAlert(metric);
    }

    this.metrics.get(key)!.push(metric);

    // Keep only last 1000 metrics per key
    const metricList = this.metrics.get(key)!;
    if (metricList.length > 1000) {
      this.metrics.set(key, metricList.slice(-1000));
    }

    this.logger.debug(
      { serviceName: metric.serviceName, metricName: metric.metricName, value: metric.value },
      "Performance metric recorded"
    );
  }

  /**
   * Create alert for metric violation
   */
  private createAlert(metric: PerformanceMetric): void {
    if (!metric.threshold) return;

    const alertId = `ALERT-${Date.now()}`;
    const severity =
      metric.value > metric.threshold * 2 ? "critical" : metric.value > metric.threshold * 1.5 ? "warning" : "info";

    const alert: PerformanceAlert = {
      alertId,
      serviceName: metric.serviceName,
      metricName: metric.metricName,
      severity,
      message: `${metric.metricName} exceeded threshold: ${metric.value}${metric.unit} (threshold: ${metric.threshold}${metric.unit})`,
      expectedValue: metric.threshold,
      actualValue: metric.value,
      timestamp: metric.timestamp,
      resolved: false,
    };

    this.alerts.set(alertId, alert);

    this.logger.warn(
      {
        alertId,
        service: metric.serviceName,
        metric: metric.metricName,
        severity,
      },
      "Performance alert created"
    );
  }

  /**
   * Update service health status
   */
  updateServiceHealth(serviceName: string, health: Omit<ServiceHealth, "serviceName" | "lastChecked">): void {
    const serviceHealth: ServiceHealth = {
      serviceName,
      ...health,
      lastChecked: Date.now(),
    };

    this.serviceHealth.set(serviceName, serviceHealth);

    // Log unhealthy services
    if (health.status !== "healthy") {
      this.logger.warn(
        {
          service: serviceName,
          status: health.status,
          uptime: health.uptime,
          errorRate: health.errorRate,
        },
        "Service health degraded"
      );
    }
  }

  /**
   * Get service health
   */
  getServiceHealth(serviceName: string): ServiceHealth | undefined {
    return this.serviceHealth.get(serviceName);
  }

  /**
   * Get all service health statuses
   */
  getAllServiceHealth(): ServiceHealth[] {
    return Array.from(this.serviceHealth.values());
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(serviceName?: string): PerformanceAlert[] {
    return Array.from(this.alerts.values()).filter((alert) => {
      if (alert.resolved) return false;
      if (serviceName && alert.serviceName !== serviceName) return false;
      return true;
    });
  }

  /**
   * Get metrics for service
   */
  getServiceMetrics(serviceName: string, metricName?: string): PerformanceMetric[] {
    const results: PerformanceMetric[] = [];

    for (const [key, metrics] of this.metrics.entries()) {
      if (key.startsWith(`${serviceName}:`)) {
        if (metricName && !key.endsWith(metricName)) continue;
        results.push(...metrics);
      }
    }

    return results;
  }

  /**
   * Calculate service statistics
   */
  calculateServiceStatistics(serviceName: string): {
    metricsCount: number;
    avgResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    alertCount: number;
    health: ServiceHealth | undefined;
  } {
    const metrics = this.getServiceMetrics(serviceName, "avgResponseTime");
    const responseTimes = metrics.map((m) => m.value).sort((a, b) => a - b);

    return {
      metricsCount: metrics.length,
      avgResponseTime: responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0,
      p95ResponseTime: responseTimes.length > 0 ? responseTimes[Math.floor(responseTimes.length * 0.95)] : 0,
      p99ResponseTime: responseTimes.length > 0 ? responseTimes[Math.floor(responseTimes.length * 0.99)] : 0,
      alertCount: this.getActiveAlerts(serviceName).length,
      health: this.getServiceHealth(serviceName),
    };
  }

  /**
   * Get optimization dashboard summary
   */
  getDashboardSummary(): {
    totalServices: number;
    healthyServices: number;
    degradedServices: number;
    unhealthyServices: number;
    activeAlerts: number;
    criticalAlerts: number;
    avgUptimePercent: number;
    systemStatus: "healthy" | "degraded" | "critical";
  } {
    const health = this.getAllServiceHealth();

    const healthyCounts = health.reduce(
      (acc, s) => {
        if (s.status === "healthy") acc.healthy++;
        else if (s.status === "degraded") acc.degraded++;
        else acc.unhealthy++;
        return acc;
      },
      { healthy: 0, degraded: 0, unhealthy: 0 }
    );

    const alerts = this.getActiveAlerts();
    const criticalAlerts = alerts.filter((a) => a.severity === "critical").length;
    const avgUptime = health.length > 0 ? health.reduce((sum, s) => sum + s.uptime, 0) / health.length : 100;

    let systemStatus: "healthy" | "degraded" | "critical" = "healthy";
    if (healthyCounts.unhealthy > 0 || criticalAlerts > 0) systemStatus = "critical";
    else if (healthyCounts.degraded > 0 || alerts.length > 0) systemStatus = "degraded";

    return {
      totalServices: health.length,
      healthyServices: healthyCounts.healthy,
      degradedServices: healthyCounts.degraded,
      unhealthyServices: healthyCounts.unhealthy,
      activeAlerts: alerts.length,
      criticalAlerts,
      avgUptimePercent: avgUptime,
      systemStatus,
    };
  }

  /**
   * Get optimization metrics summary for all services
   */
  getOptimizationSummary(): {
    serviceName: string;
    optimizationClass: string;
    performanceImprovement: string;
    metricsTracked: number;
    status: string;
  }[] {
    const services: Map<
      string,
      { optimizationClass: string; performanceImprovement: string }
    > = new Map([
      ["space-traffic", { optimizationClass: "SpatialGrid", performanceImprovement: "10-100x" }],
      ["digital-twin", { optimizationClass: "KeplerSolver", performanceImprovement: "10x" }],
      ["orbital-networking", { optimizationClass: "dijkstraOptimized", performanceImprovement: "10x" }],
      ["autonomy-core", { optimizationClass: "VectorizedFormationControl", performanceImprovement: "~5x" }],
      ["thermal-engine", { optimizationClass: "VectorizedThermalModel", performanceImprovement: "~8x" }],
      ["radiation-runtime", { optimizationClass: "OptimizedECC", performanceImprovement: "10x" }],
      ["inference-runtime", { optimizationClass: "OptimizedGradientCompressor", performanceImprovement: "4x" }],
      ["edge-compute", { optimizationClass: "OptimizedGradientCompressor", performanceImprovement: "4x" }],
      ["control-plane", { optimizationClass: "PriorityQueue", performanceImprovement: "~3x" }],
      ["federation-hub", { optimizationClass: "Single-pass Selection", performanceImprovement: "10-15x" }],
      ["science-ops", { optimizationClass: "VectorizedImageAnalyzer", performanceImprovement: "4-10x" }],
      ["blockchain", { optimizationClass: "Single-pass Queries + Caching", performanceImprovement: "2-10x" }],
    ]);

    return Array.from(services.entries()).map(([serviceName, info]) => ({
      serviceName,
      optimizationClass: info.optimizationClass,
      performanceImprovement: info.performanceImprovement,
      metricsTracked: this.getServiceMetrics(serviceName).length,
      status: this.getServiceHealth(serviceName)?.status || "unknown",
    }));
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;

    alert.resolved = true;
    this.logger.info({ alertId }, "Alert resolved");

    return true;
  }
}

export default OptimizationMonitor;
