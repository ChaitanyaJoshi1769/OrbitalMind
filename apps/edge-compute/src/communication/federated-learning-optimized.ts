/**
 * Optimized Federated Learning Communication
 *
 * Uses OptimizedGradientCompressor from optimization-lib for:
 * - 4x sparse gradient compression
 * - Efficient inter-satellite bandwidth reduction
 * - Byzantine-robust aggregation with compression
 */

import pino from "pino";
import { EventEmitter } from "events";
import { OptimizedGradientCompressor } from "@orbitalmind/optimization-lib";

/**
 * Compressed gradient update
 */
export interface CompressedGradientUpdate {
  modelId: string;
  epoch: number;
  participantId: string;
  timestamp: number;
  indices: Uint32Array;
  values: Float32Array;
  originalSize: number;
  compressionRatio: number;
  sampleCount: number;
  loss: number;
}

/**
 * Aggregated update from consensus round
 */
export interface AggregatedUpdateOptimized {
  modelId: string;
  epoch: number;
  aggregatedGradients: Float32Array;
  participantCount: number;
  aggregationMethod: "fedavg" | "median" | "krum";
  confidenceScore: number;
  timestamp: number;
}

/**
 * Per-satellite training metrics
 */
export interface SatelliteMetricsOptimized {
  satelliteId: string;
  modelsTraining: string[];
  localLoss: number;
  localAccuracy: number;
  lastUpdateEpoch: number;
  gradientsSent: number;
  gradientsReceived: number;
  communicationBandwidthKbps: number;
  computeUtilizationPercent: number;
  lastSyncTimestamp: number;
  totalCompressionSaved: number;
  avgCompressionRatio: number;
}

/**
 * Federated Learning Coordinator with Optimized Compression
 */
export class FederatedLearningCoordinatorOptimized extends EventEmitter {
  private logger = pino();
  private satelliteMetrics: Map<string, SatelliteMetricsOptimized>;
  private compressor: OptimizedGradientCompressor;
  private currentEpoch: number = 0;
  private gradientHistory: Map<string, CompressedGradientUpdate[]> = new Map();
  private compressionStats = {
    totalCompressions: 0,
    totalSaved: 0,
    avgRatio: 1.0,
    peakRatio: 1.0
  };

  constructor() {
    super();
    this.satelliteMetrics = new Map();
    this.compressor = new OptimizedGradientCompressor();
  }

  /**
   * Register satellite for federated learning
   */
  registerSatellite(satelliteId: string, modelsToTrain: string[]): void {
    const metrics: SatelliteMetricsOptimized = {
      satelliteId,
      modelsTraining: modelsToTrain,
      localLoss: Number.MAX_VALUE,
      localAccuracy: 0,
      lastUpdateEpoch: 0,
      gradientsSent: 0,
      gradientsReceived: 0,
      communicationBandwidthKbps: 0,
      computeUtilizationPercent: 0,
      lastSyncTimestamp: Date.now(),
      totalCompressionSaved: 0,
      avgCompressionRatio: 1.0
    };

    this.satelliteMetrics.set(satelliteId, metrics);
    this.gradientHistory.set(satelliteId, []);

    this.logger.info(
      { satelliteId, models: modelsToTrain },
      "Satellite registered for federated learning with optimized compression"
    );

    this.emit("satellite:registered", { satelliteId, modelsToTrain });
  }

  /**
   * Compress and submit gradients from satellite
   * Uses sparse representation for 4x typical compression
   */
  submitGradientsOptimized(
    modelId: string,
    gradients: number[],
    participantId: string,
    epoch: number,
    sampleCount: number,
    loss: number
  ): CompressedGradientUpdate {
    const metrics = this.satelliteMetrics.get(participantId);
    if (!metrics) {
      throw new Error(`Satellite not registered: ${participantId}`);
    }

    // Convert to Float32Array for compression
    const gradientArray = new Float32Array(gradients);

    // Compress using sparse representation (4x typical compression)
    const compressed = this.compressor.compressSparse(gradientArray);

    const update: CompressedGradientUpdate = {
      modelId,
      epoch,
      participantId,
      timestamp: Date.now(),
      indices: compressed.indices,
      values: compressed.values,
      originalSize: gradients.length,
      compressionRatio: gradients.length / (compressed.indices.length + compressed.values.length),
      sampleCount,
      loss
    };

    // Track metrics
    metrics.lastUpdateEpoch = epoch;
    metrics.gradientsSent++;
    const saved = (gradients.length * 4) - (compressed.indices.length * 4 + compressed.values.length * 4);
    metrics.totalCompressionSaved += saved;
    metrics.avgCompressionRatio = (metrics.avgCompressionRatio * (metrics.gradientsSent - 1) + update.compressionRatio) / metrics.gradientsSent;

    // Track global stats
    this.compressionStats.totalCompressions++;
    this.compressionStats.totalSaved += saved;
    this.compressionStats.avgRatio = (this.compressionStats.avgRatio * (this.compressionStats.totalCompressions - 1) + update.compressionRatio) / this.compressionStats.totalCompressions;
    this.compressionStats.peakRatio = Math.max(this.compressionStats.peakRatio, update.compressionRatio);

    // Store in history (keep last 50)
    const history = this.gradientHistory.get(participantId) || [];
    history.push(update);
    if (history.length > 50) {
      history.shift();
    }
    this.gradientHistory.set(participantId, history);

    this.logger.info(
      {
        participantId,
        modelId,
        epoch,
        originalSize: gradients.length,
        compressedSize: compressed.indices.length + compressed.values.length,
        compressionRatio: update.compressionRatio.toFixed(2),
        savedBytes: saved
      },
      "Gradients compressed and submitted"
    );

    this.emit("gradients:submitted", update);

    return update;
  }

  /**
   * Decompress gradients for aggregation
   */
  decompressGradients(
    compressed: CompressedGradientUpdate
  ): Float32Array {
    const decompressed = this.compressor.decompressSparse(
      compressed.indices,
      compressed.originalSize
    );

    // Copy values into the decompressed array
    for (let i = 0; i < compressed.indices.length; i++) {
      decompressed[compressed.indices[i]] = compressed.values[i];
    }

    return decompressed;
  }

  /**
   * Aggregate gradients using FedAvg (weighted average)
   */
  aggregateGradientsFedAvg(
    gradients: CompressedGradientUpdate[]
  ): AggregatedUpdateOptimized {
    if (gradients.length === 0) {
      throw new Error("No gradients to aggregate");
    }

    const modelId = gradients[0].modelId;
    const epoch = gradients[0].epoch;
    const gradientSize = gradients[0].originalSize;

    // Decompress all gradients
    const decompressed = gradients.map(g => this.decompressGradients(g));

    // Calculate total samples for weighting
    const totalSamples = gradients.reduce((sum, g) => sum + g.sampleCount, 0);

    // Weighted average
    const aggregated = new Float32Array(gradientSize);
    for (let i = 0; i < decompressed.length; i++) {
      const weight = gradients[i].sampleCount / totalSamples;
      for (let j = 0; j < gradientSize; j++) {
        aggregated[j] += decompressed[i][j] * weight;
      }
    }

    return {
      modelId,
      epoch,
      aggregatedGradients: aggregated,
      participantCount: gradients.length,
      aggregationMethod: "fedavg",
      confidenceScore: 0.95,
      timestamp: Date.now()
    };
  }

  /**
   * Aggregate gradients using Median (Byzantine-robust)
   */
  aggregateGradientsMedian(
    gradients: CompressedGradientUpdate[]
  ): AggregatedUpdateOptimized {
    if (gradients.length === 0) {
      throw new Error("No gradients to aggregate");
    }

    const modelId = gradients[0].modelId;
    const epoch = gradients[0].epoch;
    const gradientSize = gradients[0].originalSize;

    // Decompress all gradients
    const decompressed = gradients.map(g => this.decompressGradients(g));

    // Element-wise median
    const aggregated = new Float32Array(gradientSize);
    for (let i = 0; i < gradientSize; i++) {
      const values = decompressed
        .map(d => d[i])
        .sort((a, b) => a - b);

      const mid = Math.floor(values.length / 2);
      if (values.length % 2 === 0) {
        aggregated[i] = (values[mid - 1] + values[mid]) / 2;
      } else {
        aggregated[i] = values[mid];
      }
    }

    return {
      modelId,
      epoch,
      aggregatedGradients: aggregated,
      participantCount: gradients.length,
      aggregationMethod: "median",
      confidenceScore: 0.88,
      timestamp: Date.now()
    };
  }

  /**
   * Get satellite metrics
   */
  getSatelliteMetrics(satelliteId: string): SatelliteMetricsOptimized | undefined {
    return this.satelliteMetrics.get(satelliteId);
  }

  /**
   * Get all satellite metrics
   */
  getAllSatelliteMetrics(): SatelliteMetricsOptimized[] {
    return Array.from(this.satelliteMetrics.values());
  }

  /**
   * Get compression statistics
   */
  getCompressionStatistics() {
    return {
      totalCompressions: this.compressionStats.totalCompressions,
      totalBytesCompressions: this.compressionStats.totalSaved,
      avgCompressionRatio: this.compressionStats.avgRatio.toFixed(2),
      peakCompressionRatio: this.compressionStats.peakRatio.toFixed(2),
      bytesSavedPerUpdate: this.compressionStats.totalCompressions > 0
        ? Math.floor(this.compressionStats.totalSaved / this.compressionStats.totalCompressions)
        : 0
    };
  }

  /**
   * Increment epoch
   */
  nextEpoch(): number {
    this.currentEpoch++;
    this.logger.debug({ epoch: this.currentEpoch }, "Moved to next epoch");
    return this.currentEpoch;
  }

  /**
   * Get current epoch
   */
  getCurrentEpoch(): number {
    return this.currentEpoch;
  }
}

export default FederatedLearningCoordinatorOptimized;
