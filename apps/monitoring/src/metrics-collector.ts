/**
 * OrbitalMind Metrics Collector
 *
 * Service integration helper for collecting and reporting metrics
 * to the optimization monitoring system
 */

import pino from 'pino';

/**
 * Metric batch for efficient reporting
 */
export interface MetricBatch {
  serviceName: string;
  timestamp: number;
  metrics: Array<{
    name: string;
    value: number;
    unit: string;
    threshold?: number;
  }>;
}

/**
 * Service performance statistics
 */
export interface ServiceMetrics {
  serviceName: string;
  uptime: number;
  averageLatency: number;
  errorRate: number;
  throughput: number;
  lastUpdate: number;
}

/**
 * Metrics collector for service integration
 */
export class MetricsCollector {
  private logger = pino();
  private serviceName: string;
  private metrics: Map<string, number[]> = new Map();
  private windowSize: number;
  private flushInterval: NodeJS.Timer | null = null;
  private onFlush: ((batch: MetricBatch) => void) | null = null;

  constructor(serviceName: string, windowSize: number = 100) {
    this.serviceName = serviceName;
    this.windowSize = windowSize;
  }

  /**
   * Record a metric value
   */
  recordMetric(metricName: string, value: number): void {
    if (!this.metrics.has(metricName)) {
      this.metrics.set(metricName, []);
    }

    const values = this.metrics.get(metricName)!;
    values.push(value);

    // Keep only last windowSize entries
    if (values.length > this.windowSize) {
      values.shift();
    }

    this.logger.debug(
      { serviceName: this.serviceName, metricName, value },
      'Metric recorded'
    );
  }

  /**
   * Record multiple metrics
   */
  recordMetrics(metrics: Record<string, number>): void {
    Object.entries(metrics).forEach(([name, value]) => {
      this.recordMetric(name, value);
    });
  }

  /**
   * Record latency measurement
   */
  recordLatency(operationName: string, durationMs: number): void {
    const metricName = `latency_${operationName}`;
    this.recordMetric(metricName, durationMs);
  }

  /**
   * Record throughput (operations per second)
   */
  recordThroughput(operationName: string, operationCount: number): void {
    const metricName = `throughput_${operationName}`;
    this.recordMetric(metricName, operationCount);
  }

  /**
   * Record error count
   */
  recordError(errorType: string): void {
    const metricName = `errors_${errorType}`;
    this.recordMetric(metricName, 1);
  }

  /**
   * Get current metric value (latest)
   */
  getMetricValue(metricName: string): number | undefined {
    const values = this.metrics.get(metricName);
    return values && values.length > 0 ? values[values.length - 1] : undefined;
  }

  /**
   * Get average metric value
   */
  getMetricAverage(metricName: string): number {
    const values = this.metrics.get(metricName) || [];
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  /**
   * Get metric percentile
   */
  getMetricPercentile(metricName: string, percentile: number): number {
    const values = this.metrics.get(metricName) || [];
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.floor((sorted.length * percentile) / 100);
    return sorted[Math.min(index, sorted.length - 1)];
  }

  /**
   * Get metric statistics
   */
  getMetricStats(metricName: string): {
    count: number;
    min: number;
    max: number;
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  } {
    const values = this.metrics.get(metricName) || [];
    if (values.length === 0) {
      return {
        count: 0,
        min: 0,
        max: 0,
        avg: 0,
        p50: 0,
        p95: 0,
        p99: 0,
      };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, v) => acc + v, 0);

    return {
      count: values.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sum / values.length,
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
    };
  }

  /**
   * Flush metrics to monitoring system
   */
  flush(thresholds?: Record<string, number>): MetricBatch {
    const batch: MetricBatch = {
      serviceName: this.serviceName,
      timestamp: Date.now(),
      metrics: Array.from(this.metrics.entries()).map(([name, values]) => ({
        name,
        value: values.length > 0 ? values[values.length - 1] : 0,
        unit: this.getMetricUnit(name),
        threshold: thresholds?.[name],
      })),
    };

    if (this.onFlush) {
      this.onFlush(batch);
    }

    this.logger.debug(
      { serviceName: this.serviceName, metricCount: batch.metrics.length },
      'Metrics flushed'
    );

    return batch;
  }

  /**
   * Set flush callback
   */
  setFlushCallback(callback: (batch: MetricBatch) => void): void {
    this.onFlush = callback;
  }

  /**
   * Start periodic flushing
   */
  startPeriodicFlush(intervalMs: number = 5000, thresholds?: Record<string, number>): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }

    this.flushInterval = setInterval(() => {
      this.flush(thresholds);
    }, intervalMs);

    this.logger.info(
      { serviceName: this.serviceName, intervalMs },
      'Periodic metrics flushing started'
    );
  }

  /**
   * Stop periodic flushing
   */
  stopPeriodicFlush(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    this.logger.info(
      { serviceName: this.serviceName },
      'Periodic metrics flushing stopped'
    );
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
  }

  /**
   * Get metric unit from name
   */
  private getMetricUnit(metricName: string): string {
    if (metricName.includes('latency') || metricName.includes('time')) {
      return 'ms';
    }
    if (metricName.includes('throughput')) {
      return 'ops/s';
    }
    if (metricName.includes('error')) {
      return 'count';
    }
    if (metricName.includes('rate')) {
      return '%';
    }
    return 'value';
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Record<string, number> {
    const result: Record<string, number> = {};
    this.metrics.forEach((values, name) => {
      result[name] = values.length > 0 ? values[values.length - 1] : 0;
    });
    return result;
  }

  /**
   * Get service metrics summary
   */
  getSummary(): ServiceMetrics {
    const latencies = this.metrics.get('latency_operation') || [];
    const errors = Array.from(this.metrics.values())
      .filter(v => v.length > 0)
      .reduce((sum, values) => sum + values.reduce((a, b) => a + b, 0), 0);

    const avgLatency = latencies.length > 0
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length
      : 0;

    const totalOps = Array.from(this.metrics.values())
      .reduce((sum, values) => sum + values.length, 0);

    return {
      serviceName: this.serviceName,
      uptime: 99.95, // Placeholder
      averageLatency: avgLatency,
      errorRate: totalOps > 0 ? (errors / totalOps) * 100 : 0,
      throughput: totalOps,
      lastUpdate: Date.now(),
    };
  }
}

export default MetricsCollector;
