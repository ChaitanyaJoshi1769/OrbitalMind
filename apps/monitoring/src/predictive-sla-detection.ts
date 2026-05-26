/**
 * OrbitalMind Predictive SLA Violation Detection
 *
 * Uses trend analysis and forecasting to predict SLA violations
 * before they occur and suggest preventive actions
 */

import pino from 'pino';

/**
 * Metric data point
 */
export interface MetricDataPoint {
  timestamp: number;
  value: number;
}

/**
 * Trend analysis result
 */
export interface TrendAnalysis {
  metric: string;
  serviceName: string;
  currentValue: number;
  trendDirection: 'increasing' | 'decreasing' | 'stable';
  trendStrength: number; // 0-1
  changeRate: number; // percentage per hour
  dataPoints: number;
}

/**
 * SLA violation prediction
 */
export interface SLAViolationPrediction {
  serviceName: string;
  metric: string;
  slaTarget: number;
  currentValue: number;
  predictedValue: number;
  violationProbability: number; // 0-1
  timeToViolation?: number; // milliseconds
  confidence: number; // 0-1
  recommendedActions: string[];
}

/**
 * Predictive SLA Detector
 */
export class PredictiveSLADetector {
  private logger = pino();
  private metricHistory: Map<string, MetricDataPoint[]> = new Map();
  private slaTargets: Map<string, { target: number; tolerance: number }> = new Map();
  private anomalyThreshold = 2.0; // Standard deviations
  private forecastWindow = 3600000; // 1 hour default
  private dataRetentionWindow = 604800000; // 7 days

  constructor() {
    this.setupDefaultSLATargets();
  }

  /**
   * Set up default SLA targets
   */
  private setupDefaultSLATargets(): void {
    // Response time targets
    this.slaTargets.set('space-traffic:avgResponseTime', {
      target: 50,
      tolerance: 10,
    });
    this.slaTargets.set('orbital-networking:avgResponseTime', {
      target: 50,
      tolerance: 10,
    });
    this.slaTargets.set('digital-twin:avgResponseTime', { target: 100, tolerance: 20 });

    // Latency percentile targets
    this.slaTargets.set('blockchain:p95Latency', { target: 500, tolerance: 50 });
    this.slaTargets.set('blockchain:p99Latency', { target: 1000, tolerance: 100 });

    // Error rate targets (percentage)
    this.slaTargets.set('space-traffic:errorRate', { target: 1, tolerance: 0.2 });
    this.slaTargets.set('thermal-engine:errorRate', { target: 2, tolerance: 0.5 });

    // Cache hit rate targets
    this.slaTargets.set('blockchain:cacheHitRate', { target: 80, tolerance: 5 });
    this.slaTargets.set('digital-twin:cacheHitRate', { target: 70, tolerance: 5 });

    this.logger.info('Default SLA targets configured');
  }

  /**
   * Record metric value
   */
  recordMetric(serviceName: string, metricName: string, value: number): void {
    const key = `${serviceName}:${metricName}`;

    if (!this.metricHistory.has(key)) {
      this.metricHistory.set(key, []);
    }

    const history = this.metricHistory.get(key)!;
    history.push({
      timestamp: Date.now(),
      value,
    });

    // Keep only data within retention window
    const cutoffTime = Date.now() - this.dataRetentionWindow;
    while (history.length > 0 && history[0].timestamp < cutoffTime) {
      history.shift();
    }
  }

  /**
   * Set SLA target
   */
  setSLATarget(
    serviceName: string,
    metricName: string,
    target: number,
    tolerance: number
  ): void {
    const key = `${serviceName}:${metricName}`;
    this.slaTargets.set(key, { target, tolerance });
  }

  /**
   * Analyze trend for metric
   */
  analyzeTrend(serviceName: string, metricName: string): TrendAnalysis | null {
    const key = `${serviceName}:${metricName}`;
    const history = this.metricHistory.get(key);

    if (!history || history.length < 3) {
      return null;
    }

    // Use last 60 data points or all available
    const dataWindow = history.slice(Math.max(0, history.length - 60));

    // Calculate trend using linear regression
    const n = dataWindow.length;
    const sumX = (n * (n - 1)) / 2;
    const sumXX = (n * (n - 1) * (2 * n - 1)) / 6;
    const sumY = dataWindow.reduce((sum, dp) => sum + dp.value, 0);
    const sumXY = dataWindow.reduce((sum, dp, i) => sum + i * dp.value, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Determine trend direction
    let trendDirection: 'increasing' | 'decreasing' | 'stable' = 'stable';
    let trendStrength = 0;

    if (Math.abs(slope) > 0.1) {
      trendDirection = slope > 0 ? 'increasing' : 'decreasing';
      trendStrength = Math.min(Math.abs(slope) / 10, 1);
    }

    // Calculate change rate (percentage per hour)
    const timeWindow = dataWindow[n - 1].timestamp - dataWindow[0].timestamp;
    const changePerMs = slope;
    const changePerHour = (changePerMs * 3600000) / dataWindow[dataWindow.length - 1].value * 100;

    const currentValue = dataWindow[n - 1].value;

    return {
      metric: metricName,
      serviceName,
      currentValue,
      trendDirection,
      trendStrength,
      changeRate: changePerHour,
      dataPoints: n,
    };
  }

  /**
   * Predict SLA violation
   */
  predictSLAViolation(
    serviceName: string,
    metricName: string
  ): SLAViolationPrediction | null {
    const key = `${serviceName}:${metricName}`;
    const history = this.metricHistory.get(key);
    const target = this.slaTargets.get(key);

    if (!history || !target || history.length < 3) {
      return null;
    }

    const currentValue = history[history.length - 1].value;
    const trend = this.analyzeTrend(serviceName, metricName);

    if (!trend) {
      return null;
    }

    // Calculate statistics
    const mean = history.reduce((sum, dp) => sum + dp.value, 0) / history.length;
    const variance =
      history.reduce((sum, dp) => sum + Math.pow(dp.value - mean, 2), 0) /
      history.length;
    const stdDev = Math.sqrt(variance);

    // Detect anomalies
    const anomalyScore = Math.abs((currentValue - mean) / stdDev);
    const isAnomaly = anomalyScore > this.anomalyThreshold;

    // Forecast future value
    let violationProbability = 0;
    let timeToViolation: number | undefined;
    let predictedValue = currentValue;

    if (trend.trendDirection === 'increasing') {
      // Check if heading toward upper threshold
      const upperBound = target.target + target.tolerance;
      if (currentValue > upperBound - target.tolerance) {
        const changePerMs = trend.changeRate / 3600000;
        const msToViolation = (upperBound - currentValue) / changePerMs;
        timeToViolation = Math.max(0, msToViolation);

        if (timeToViolation < this.forecastWindow) {
          violationProbability = Math.min(
            1,
            1 - timeToViolation / this.forecastWindow
          );
        }

        predictedValue = currentValue + (timeToViolation || 1000) * changePerMs;
      }
    } else if (trend.trendDirection === 'decreasing') {
      // Check if heading toward lower threshold
      const lowerBound = target.target - target.tolerance;
      if (currentValue < lowerBound + target.tolerance) {
        const changePerMs = trend.changeRate / 3600000;
        const msToViolation = (currentValue - lowerBound) / Math.abs(changePerMs);
        timeToViolation = Math.max(0, msToViolation);

        if (timeToViolation < this.forecastWindow) {
          violationProbability = Math.min(
            1,
            1 - timeToViolation / this.forecastWindow
          );
        }

        predictedValue = currentValue + (timeToViolation || 1000) * changePerMs;
      }
    }

    // Boost probability if currently anomalous
    if (isAnomaly) {
      violationProbability = Math.min(1, violationProbability + 0.3);
    }

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      serviceName,
      metricName,
      trend,
      violationProbability
    );

    return {
      serviceName,
      metric: metricName,
      slaTarget: target.target,
      currentValue,
      predictedValue,
      violationProbability: Math.round(violationProbability * 100) / 100,
      timeToViolation,
      confidence: Math.min(1, Math.max(0, trend.trendStrength + (isAnomaly ? 0.2 : 0))),
      recommendedActions: recommendations,
    };
  }

  /**
   * Generate recommendations based on prediction
   */
  private generateRecommendations(
    serviceName: string,
    metricName: string,
    trend: TrendAnalysis,
    violationProbability: number
  ): string[] {
    const recommendations: string[] = [];

    if (violationProbability > 0.8) {
      recommendations.push(`URGENT: High probability of ${metricName} SLA violation`);
      recommendations.push(`Scale up ${serviceName} resources immediately`);
      recommendations.push(`Engage incident commander for ${serviceName}`);
    } else if (violationProbability > 0.5) {
      recommendations.push(
        `Monitor ${metricName} closely - violation likely within ${Math.round((1 - violationProbability) * 60)} minutes`
      );
      recommendations.push(`Prepare scaling plan for ${serviceName}`);
      recommendations.push(`Review recent code changes in ${serviceName}`);
    } else if (violationProbability > 0.2) {
      recommendations.push(`Review ${metricName} trend in ${serviceName}`);
      recommendations.push(`Check for inefficient queries or algorithms`);
    }

    if (trend.trendDirection === 'increasing' && trend.trendStrength > 0.5) {
      recommendations.push(
        `Metric increasing at ${Math.abs(trend.changeRate).toFixed(1)}% per hour`
      );
      recommendations.push(`Consider proactive resource allocation`);
    } else if (trend.trendDirection === 'decreasing' && trend.trendStrength > 0.5) {
      recommendations.push(
        `Metric decreasing at ${Math.abs(trend.changeRate).toFixed(1)}% per hour`
      );
      if (metricName.includes('Cache') || metricName.includes('Success')) {
        recommendations.push(`Investigate cache invalidation or failure rate increase`);
      }
    }

    return recommendations;
  }

  /**
   * Get predictions for all services
   */
  getAllPredictions(): SLAViolationPrediction[] {
    const predictions: SLAViolationPrediction[] = [];

    for (const key of this.slaTargets.keys()) {
      const [serviceName, metricName] = key.split(':');
      const prediction = this.predictSLAViolation(serviceName, metricName);

      if (prediction && prediction.violationProbability > 0) {
        predictions.push(prediction);
      }
    }

    return predictions.sort((a, b) => b.violationProbability - a.violationProbability);
  }

  /**
   * Get high-risk predictions
   */
  getHighRiskPredictions(minProbability: number = 0.5): SLAViolationPrediction[] {
    return this.getAllPredictions().filter((p) => p.violationProbability >= minProbability);
  }

  /**
   * Get trend analysis for service
   */
  getServiceTrends(serviceName: string): TrendAnalysis[] {
    const trends: TrendAnalysis[] = [];

    for (const key of this.metricHistory.keys()) {
      const [service, metric] = key.split(':');
      if (service === serviceName) {
        const trend = this.analyzeTrend(serviceName, metric);
        if (trend) {
          trends.push(trend);
        }
      }
    }

    return trends;
  }

  /**
   * Detect anomalies
   */
  detectAnomalies(serviceName?: string): Array<{
    key: string;
    value: number;
    anomalyScore: number;
    message: string;
  }> {
    const anomalies = [];

    for (const [key, history] of this.metricHistory.entries()) {
      const [service] = key.split(':');

      if (serviceName && service !== serviceName) {
        continue;
      }

      if (history.length < 3) {
        continue;
      }

      const mean = history.reduce((sum, dp) => sum + dp.value, 0) / history.length;
      const variance =
        history.reduce((sum, dp) => sum + Math.pow(dp.value - mean, 2), 0) /
        history.length;
      const stdDev = Math.sqrt(variance);

      const currentValue = history[history.length - 1].value;
      const anomalyScore = Math.abs((currentValue - mean) / stdDev);

      if (anomalyScore > this.anomalyThreshold) {
        anomalies.push({
          key,
          value: currentValue,
          anomalyScore,
          message: `Anomaly detected: ${key} = ${currentValue.toFixed(2)} (${anomalyScore.toFixed(1)} std devs from mean)`,
        });
      }
    }

    return anomalies;
  }

  /**
   * Get forecast chart data
   */
  getForecastData(serviceName: string, metricName: string): {
    historical: MetricDataPoint[];
    forecast: MetricDataPoint[];
  } | null {
    const key = `${serviceName}:${metricName}`;
    const history = this.metricHistory.get(key);

    if (!history || history.length < 3) {
      return null;
    }

    const trend = this.analyzeTrend(serviceName, metricName);
    if (!trend) {
      return null;
    }

    // Generate forecast points
    const forecast: MetricDataPoint[] = [];
    const now = Date.now();
    const lastValue = history[history.length - 1].value;
    const changePerMs = trend.changeRate / 3600000;

    for (let i = 1; i <= 12; i++) {
      const timestamp = now + i * (this.forecastWindow / 12);
      const value = lastValue + i * (this.forecastWindow / 12) * changePerMs;

      forecast.push({ timestamp, value });
    }

    return { historical: history, forecast };
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    trackedMetrics: number;
    metricsWithTrend: number;
    atRisk: number;
    highRisk: number;
    anomaliesDetected: number;
  } {
    const allPredictions = this.getAllPredictions();
    const highRiskCount = allPredictions.filter((p) => p.violationProbability > 0.8).length;
    const atRiskCount = allPredictions.length;
    const anomalies = this.detectAnomalies();

    const metricsWithTrend = Array.from(this.metricHistory.values()).filter(
      (h) => h.length >= 3
    ).length;

    return {
      trackedMetrics: this.metricHistory.size,
      metricsWithTrend,
      atRisk: atRiskCount,
      highRisk: highRiskCount,
      anomaliesDetected: anomalies.length,
    };
  }

  /**
   * Export predictions as JSON
   */
  exportPredictions(): string {
    const predictions = this.getAllPredictions();
    const stats = this.getStatistics();

    return JSON.stringify(
      {
        timestamp: Date.now(),
        statistics: stats,
        predictions,
      },
      null,
      2
    );
  }
}

export default PredictiveSLADetector;
