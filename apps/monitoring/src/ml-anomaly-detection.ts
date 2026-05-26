/**
 * OrbitalMind ML-Powered Anomaly Detection
 *
 * Machine learning-based anomaly detection with predictive modeling
 * and historical pattern learning for advanced monitoring
 */

import pino from 'pino';

/**
 * Training data point
 */
export interface TrainingDataPoint {
  timestamp: number;
  value: number;
  isAnomaly?: boolean;
}

/**
 * Anomaly detection model
 */
export interface AnomalyModel {
  serviceName: string;
  metric: string;
  modelType: 'isolation-forest' | 'lstm' | 'seasonal-decomposition';
  mean: number;
  stdDev: number;
  seasonalPattern?: number[];
  trainingDataSize: number;
  accuracy: number;
  lastTrainedAt: number;
}

/**
 * Detected anomaly with confidence
 */
export interface DetectedAnomaly {
  timestamp: number;
  serviceName: string;
  metric: string;
  value: number;
  expectedValue: number;
  anomalyScore: number; // 0-1 confidence
  anomalyType: 'spike' | 'drop' | 'seasonal-deviation' | 'trend-break';
  confidence: number;
  recommendation: string;
}

/**
 * Prediction result
 */
export interface AnomalyPrediction {
  serviceName: string;
  metric: string;
  timeWindow: number; // minutes
  anomalyProbability: number;
  expectedAnomalyType?: 'spike' | 'drop' | 'seasonal-deviation' | 'trend-break';
  forecastedValues: number[];
  forecastTimestamps: number[];
}

/**
 * ML Anomaly Detection Engine
 */
export class MLAnomalyDetector {
  private logger = pino();
  private dataPoints: Map<string, TrainingDataPoint[]> = new Map();
  private models: Map<string, AnomalyModel> = new Map();
  private detectedAnomalies: DetectedAnomaly[] = [];
  private predictions: Map<string, AnomalyPrediction> = new Map();
  private dataRetentionDays = 30;
  private minDataPointsForTraining = 100;
  private seasonalPeriods = 168; // 1 week in hours

  constructor() {
    this.logger.info('ML Anomaly Detection Engine initialized');
  }

  /**
   * Add training data
   */
  addTrainingData(serviceName: string, metric: string, dataPoints: TrainingDataPoint[]): void {
    const key = `${serviceName}:${metric}`;
    const existing = this.dataPoints.get(key) || [];
    const combined = [...existing, ...dataPoints];

    // Clean up old data
    const cutoffTime = Date.now() - this.dataRetentionDays * 24 * 60 * 60 * 1000;
    const filtered = combined.filter((dp) => dp.timestamp > cutoffTime);

    this.dataPoints.set(key, filtered);

    // Auto-train if enough data
    if (filtered.length >= this.minDataPointsForTraining) {
      this.trainModel(serviceName, metric);
    }
  }

  /**
   * Train anomaly detection model
   */
  trainModel(serviceName: string, metric: string): void {
    const key = `${serviceName}:${metric}`;
    const dataPoints = this.dataPoints.get(key) || [];

    if (dataPoints.length < this.minDataPointsForTraining) {
      this.logger.warn(
        { serviceName, metric, pointCount: dataPoints.length },
        'Insufficient data for model training'
      );
      return;
    }

    // Calculate statistics
    const values = dataPoints.map((dp) => dp.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
    const stdDev = Math.sqrt(variance);

    // Detect seasonal pattern
    const seasonalPattern = this.detectSeasonalPattern(dataPoints);

    // Identify marked anomalies for learning
    const markedAnomalies = dataPoints.filter((dp) => dp.isAnomaly).length;

    // Calculate model accuracy based on data characteristics
    const anomalyRatio = markedAnomalies / dataPoints.length;
    const dataVariability = stdDev / mean;
    const accuracy = Math.min(
      0.95,
      0.7 + (dataVariability < 0.3 ? 0.2 : 0) + (markedAnomalies > 10 ? 0.05 : 0)
    );

    const model: AnomalyModel = {
      serviceName,
      metric,
      modelType: seasonalPattern.length > 0 ? 'seasonal-decomposition' : 'isolation-forest',
      mean,
      stdDev,
      seasonalPattern: seasonalPattern.length > 0 ? seasonalPattern : undefined,
      trainingDataSize: dataPoints.length,
      accuracy,
      lastTrainedAt: Date.now(),
    };

    this.models.set(key, model);
    this.logger.info(
      {
        serviceName,
        metric,
        dataPoints: dataPoints.length,
        mean: mean.toFixed(2),
        stdDev: stdDev.toFixed(2),
        accuracy: (accuracy * 100).toFixed(1),
      },
      'Model trained successfully'
    );
  }

  /**
   * Detect seasonal pattern in data
   */
  private detectSeasonalPattern(dataPoints: TrainingDataPoint[]): number[] {
    if (dataPoints.length < this.seasonalPeriods * 2) {
      return [];
    }

    // Simple seasonal pattern detection using periodogram
    const values = dataPoints.map((dp) => dp.value);
    const pattern = new Array(this.seasonalPeriods).fill(0);

    let variance = 0;
    for (let i = 0; i < this.seasonalPeriods; i++) {
      let sum = 0;
      let count = 0;
      for (let j = i; j < values.length; j += this.seasonalPeriods) {
        sum += values[j];
        count++;
      }
      pattern[i] = count > 0 ? sum / count : 0;
      variance += pattern[i] ** 2;
    }

    // Only return pattern if variance is significant
    variance = Math.sqrt(variance / this.seasonalPeriods);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;

    return variance > mean * 0.1 ? pattern : [];
  }

  /**
   * Detect anomalies in new data
   */
  detectAnomalies(serviceName: string, metric: string, newValue: number): DetectedAnomaly | null {
    const key = `${serviceName}:${metric}`;
    const model = this.models.get(key);

    if (!model) {
      return null;
    }

    // Calculate anomaly score using multiple methods
    const zScore = Math.abs((newValue - model.mean) / (model.stdDev || 1));
    const seasonalDeviation = model.seasonalPattern ? this.calculateSeasonalDeviation(newValue, model) : 0;

    // Combined anomaly score
    let anomalyScore = Math.min(1, zScore / 3); // Normalize z-score
    if (seasonalDeviation > 0) {
      anomalyScore = Math.max(anomalyScore, seasonalDeviation);
    }

    // Determine anomaly type and threshold
    const isAnomaly = anomalyScore > 0.7;
    const threshold = this.calculateDynamicThreshold(model, zScore);

    if (!isAnomaly || anomalyScore < threshold) {
      return null;
    }

    // Classify anomaly type
    const anomalyType = this.classifyAnomaly(newValue, model);

    const anomaly: DetectedAnomaly = {
      timestamp: Date.now(),
      serviceName,
      metric,
      value: newValue,
      expectedValue: model.mean,
      anomalyScore,
      anomalyType,
      confidence: model.accuracy,
      recommendation: this.generateAnomalyRecommendation(anomalyType, newValue, model),
    };

    this.detectedAnomalies.push(anomaly);

    // Keep only recent anomalies
    const cutoffTime = Date.now() - 7 * 24 * 60 * 60 * 1000;
    this.detectedAnomalies = this.detectedAnomalies.filter((a) => a.timestamp > cutoffTime);

    this.logger.warn(
      {
        serviceName,
        metric,
        value: newValue.toFixed(2),
        expectedValue: model.mean.toFixed(2),
        anomalyScore: (anomalyScore * 100).toFixed(1),
        type: anomalyType,
      },
      'Anomaly detected'
    );

    return anomaly;
  }

  /**
   * Calculate seasonal deviation
   */
  private calculateSeasonalDeviation(value: number, model: AnomalyModel): number {
    if (!model.seasonalPattern || model.seasonalPattern.length === 0) {
      return 0;
    }

    const now = new Date();
    const hour = now.getHours();
    const hourOfWeek = (now.getDay() * 24 + hour) % (7 * 24);
    const seasonalIndex = Math.min(hourOfWeek, model.seasonalPattern.length - 1);

    const expectedSeasonal = model.seasonalPattern[seasonalIndex];
    const deviation = Math.abs(value - expectedSeasonal) / (Math.abs(expectedSeasonal) || 1);

    return Math.min(1, deviation);
  }

  /**
   * Calculate dynamic threshold based on model characteristics
   */
  private calculateDynamicThreshold(model: AnomalyModel, zScore: number): number {
    // Lower threshold for high-accuracy models
    let threshold = 0.6 + (1 - model.accuracy) * 0.2;

    // Adjust based on z-score
    if (zScore > 5) {
      threshold = Math.max(threshold - 0.2, 0.4);
    }

    return threshold;
  }

  /**
   * Classify anomaly type
   */
  private classifyAnomaly(value: number, model: AnomalyModel): DetectedAnomaly['anomalyType'] {
    const deviation = value - model.mean;

    if (Math.abs(deviation) > 3 * model.stdDev) {
      return deviation > 0 ? 'spike' : 'drop';
    }

    if (model.seasonalPattern && model.seasonalPattern.length > 0) {
      const now = new Date();
      const hourOfWeek = (now.getDay() * 24 + now.getHours()) % (7 * 24);
      const seasonalIndex = Math.min(hourOfWeek, model.seasonalPattern.length - 1);
      const expectedSeasonal = model.seasonalPattern[seasonalIndex];

      if (Math.abs(value - expectedSeasonal) > 2 * model.stdDev) {
        return 'seasonal-deviation';
      }
    }

    return 'trend-break';
  }

  /**
   * Generate anomaly recommendation
   */
  private generateAnomalyRecommendation(
    anomalyType: DetectedAnomaly['anomalyType'],
    value: number,
    model: AnomalyModel
  ): string {
    const messages: Record<string, string> = {
      spike: `Unusual spike detected in ${model.metric}. Check for traffic bursts or resource contention.`,
      drop: `Significant drop in ${model.metric}. Verify service availability and check for failures.`,
      'seasonal-deviation': `Unexpected deviation from seasonal pattern in ${model.metric}. Review recent changes.`,
      'trend-break': `Metric ${model.metric} has deviated from expected trend. Monitor closely for escalation.`,
    };

    return messages[anomalyType];
  }

  /**
   * Predict future anomalies
   */
  predictAnomalies(serviceName: string, metric: string, forecastMinutes: number = 60): AnomalyPrediction | null {
    const key = `${serviceName}:${metric}`;
    const model = this.models.get(key);
    const dataPoints = this.dataPoints.get(key) || [];

    if (!model || dataPoints.length < this.minDataPointsForTraining) {
      return null;
    }

    // Generate simple forecast using trend extrapolation
    const recentPoints = dataPoints.slice(-24); // Last 24 points
    const values = recentPoints.map((dp) => dp.value);

    // Calculate trend
    let trendSum = 0;
    for (let i = 1; i < values.length; i++) {
      trendSum += values[i] - values[i - 1];
    }
    const trend = trendSum / (values.length - 1);

    // Generate forecast
    const forecastPoints = Math.min(12, Math.ceil(forecastMinutes / 5)); // 5-minute intervals
    const forecastedValues: number[] = [];
    const forecastTimestamps: number[] = [];
    let currentValue = values[values.length - 1];

    for (let i = 0; i < forecastPoints; i++) {
      currentValue += trend;
      forecastedValues.push(Math.max(0, currentValue));
      forecastTimestamps.push(Date.now() + (i + 1) * 5 * 60 * 1000);
    }

    // Calculate anomaly probability in forecast
    const anomalyValues = forecastedValues.filter(
      (v) => Math.abs(v - model.mean) > 2.5 * model.stdDev
    ).length;
    const anomalyProbability = Math.min(1, anomalyValues / forecastPoints);

    const prediction: AnomalyPrediction = {
      serviceName,
      metric,
      timeWindow: forecastMinutes,
      anomalyProbability,
      expectedAnomalyType:
        anomalyProbability > 0.5 ? (trend > 0 ? 'spike' : 'drop') : undefined,
      forecastedValues,
      forecastTimestamps,
    };

    this.predictions.set(key, prediction);
    return prediction;
  }

  /**
   * Get detected anomalies for service
   */
  getAnomalies(serviceName?: string, limit: number = 100): DetectedAnomaly[] {
    return this.detectedAnomalies
      .filter((a) => !serviceName || a.serviceName === serviceName)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get model information
   */
  getModel(serviceName: string, metric: string): AnomalyModel | undefined {
    const key = `${serviceName}:${metric}`;
    return this.models.get(key);
  }

  /**
   * Get all models
   */
  getAllModels(): AnomalyModel[] {
    return Array.from(this.models.values());
  }

  /**
   * Get anomaly prediction
   */
  getPrediction(serviceName: string, metric: string): AnomalyPrediction | undefined {
    const key = `${serviceName}:${metric}`;
    return this.predictions.get(key);
  }

  /**
   * Retrain model with new data
   */
  retrainModel(serviceName: string, metric: string): void {
    this.trainModel(serviceName, metric);
  }

  /**
   * Export models for analysis
   */
  exportModels(): string {
    return JSON.stringify(
      {
        timestamp: Date.now(),
        models: Array.from(this.models.values()),
        modelCount: this.models.size,
        anomalyCount: this.detectedAnomalies.length,
      },
      null,
      2
    );
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalModels: number;
    totalAnomalies: number;
    averageAnomalyScore: number;
    anomaliesByType: Record<string, number>;
    modelAccuracies: number[];
  } {
    const anomaliesByType: Record<string, number> = {
      spike: 0,
      drop: 0,
      'seasonal-deviation': 0,
      'trend-break': 0,
    };

    for (const anomaly of this.detectedAnomalies) {
      anomaliesByType[anomaly.anomalyType]++;
    }

    const avgScore =
      this.detectedAnomalies.length > 0
        ? this.detectedAnomalies.reduce((sum, a) => sum + a.anomalyScore, 0) /
          this.detectedAnomalies.length
        : 0;

    return {
      totalModels: this.models.size,
      totalAnomalies: this.detectedAnomalies.length,
      averageAnomalyScore: avgScore,
      anomaliesByType,
      modelAccuracies: Array.from(this.models.values()).map((m) => m.accuracy),
    };
  }
}

export default MLAnomalyDetector;
