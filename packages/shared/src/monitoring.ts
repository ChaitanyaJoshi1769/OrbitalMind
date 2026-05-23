/**
 * OpenTelemetry Monitoring and Observability Types
 */

export interface Metric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  tags: Record<string, string>;
}

export interface Trace {
  traceID: string;
  spanID: string;
  operationName: string;
  duration: number;  // milliseconds
  startTime: Date;
  endTime: Date;
  status: 'success' | 'error' | 'pending';
  attributes: Record<string, unknown>;
}

export interface Log {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context: Record<string, unknown>;
  source: string;  // satellite ID or service name
}

export class MetricsCollector {
  private metrics: Metric[] = [];

  /**
   * Record a metric
   */
  public recordMetric(metric: Metric): void {
    this.metrics.push(metric);

    // Keep last 10000 metrics
    if (this.metrics.length > 10000) {
      this.metrics.shift();
    }
  }

  /**
   * Get metrics by name
   */
  public getMetricsByName(name: string): Metric[] {
    return this.metrics.filter(m => m.name === name);
  }

  /**
   * Get metrics for time range
   */
  public getMetricsForTimeRange(startTime: Date, endTime: Date): Metric[] {
    return this.metrics.filter(m => m.timestamp >= startTime && m.timestamp <= endTime);
  }

  /**
   * Calculate statistics for a metric
   */
  public getMetricStatistics(name: string) {
    const values = this.metrics
      .filter(m => m.name === name)
      .map(m => m.value);

    if (values.length === 0) return null;

    const sorted = values.sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;
    const median = sorted[Math.floor(values.length / 2)];
    const min = sorted[0];
    const max = sorted[sorted.length - 1];

    return { mean, median, min, max, count: values.length };
  }
}

export class TraceCollector {
  private traces: Trace[] = [];

  /**
   * Record a trace span
   */
  public recordTrace(trace: Trace): void {
    this.traces.push(trace);

    // Keep last 5000 traces
    if (this.traces.length > 5000) {
      this.traces.shift();
    }
  }

  /**
   * Get traces by operation
   */
  public getTracesByOperation(operationName: string): Trace[] {
    return this.traces.filter(t => t.operationName === operationName);
  }

  /**
   * Get slow traces (P95, P99 latency)
   */
  public getSlowTraces(percentile: number = 95): Trace[] {
    const sorted = [...this.traces].sort((a, b) => a.duration - b.duration);
    const cutoff = Math.ceil(sorted.length * percentile / 100);
    return sorted.slice(cutoff);
  }

  /**
   * Get error traces
   */
  public getErrorTraces(): Trace[] {
    return this.traces.filter(t => t.status === 'error');
  }
}

export class LogCollector {
  private logs: Log[] = [];

  /**
   * Record a log
   */
  public recordLog(log: Log): void {
    this.logs.push(log);

    // Keep last 10000 logs
    if (this.logs.length > 10000) {
      this.logs.shift();
    }
  }

  /**
   * Get logs by level
   */
  public getLogsByLevel(level: string): Log[] {
    return this.logs.filter(l => l.level === level);
  }

  /**
   * Get logs by source
   */
  public getLogsBySource(source: string): Log[] {
    return this.logs.filter(l => l.source === source);
  }

  /**
   * Get error logs
   */
  public getErrorLogs(): Log[] {
    return this.logs.filter(l => l.level === 'error');
  }

  /**
   * Search logs
   */
  public searchLogs(pattern: string): Log[] {
    const regex = new RegExp(pattern, 'i');
    return this.logs.filter(l => regex.test(l.message));
  }
}
