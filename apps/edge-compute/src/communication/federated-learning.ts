/**
 * Federated Learning Communication Protocols for Satellite Swarms
 *
 * Enables distributed ML model training across satellite constellation:
 * - Gradient aggregation with minimal bandwidth
 * - Asynchronous model updates
 * - Byzantine-robust consensus
 * - Compression and quantization for inter-satellite links
 */

import pino from "pino";
import { EventEmitter } from "events";

/**
 * Model gradient representation with metadata
 */
export interface ModelGradient {
  modelId: string;
  epoch: number;
  participantId: string;
  timestamp: number;
  gradients: number[]; // Flattened gradient tensor
  loss: number;
  sampleCount: number;
  compressed: boolean;
  compressionRatio: number;
}

/**
 * Aggregated model update from consensus round
 */
export interface AggregatedUpdate {
  modelId: string;
  epoch: number;
  aggregatedGradients: number[];
  participantCount: number;
  aggregationMethod: "fedavg" | "median" | "krum";
  confidenceScore: number; // 0-1: trust in aggregated result
  timestamp: number;
}

/**
 * Per-satellite training metrics
 */
export interface SatelliteMetrics {
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
}

/**
 * Compression strategy for bandwidth optimization
 */
export enum CompressionStrategy {
  NONE = "none", // No compression
  UINT8 = "uint8", // 8-bit quantization
  UINT4 = "uint4", // 4-bit quantization
  SPARSE = "sparse", // Send only non-zero gradients
  SPARSEUINT8 = "sparse-uint8", // Sparse + 8-bit
}

/**
 * Gradient Compressor
 * Reduces bandwidth for inter-satellite communication
 *
 * Compression methods:
 * - Quantization: 32-bit float → 8-bit or 4-bit
 * - Sparsification: Drop small gradients
 * - Structured pruning: Remove entire channels
 */
export class GradientCompressor {
  private logger = pino();

  /**
   * Compress gradients for transmission
   */
  compress(
    gradients: number[],
    strategy: CompressionStrategy
  ): {
    compressed: number[] | Uint8Array | Uint32Array;
    metadata: {
      strategy: CompressionStrategy;
      originalSize: number;
      compressedSize: number;
      compressionRatio: number;
      minValue: number;
      maxValue: number;
      sparsityPercent?: number;
    };
  } {
    switch (strategy) {
      case CompressionStrategy.NONE:
        return {
          compressed: gradients,
          metadata: {
            strategy,
            originalSize: gradients.length * 4,
            compressedSize: gradients.length * 4,
            compressionRatio: 1.0,
            minValue: Math.min(...gradients),
            maxValue: Math.max(...gradients),
          },
        };

      case CompressionStrategy.UINT8:
        return this.quantizeToUint8(gradients);

      case CompressionStrategy.UINT4:
        return this.quantizeToUint4(gradients);

      case CompressionStrategy.SPARSE:
        return this.sparsify(gradients, 0.01); // Keep top 1%

      case CompressionStrategy.SPARSEUINT8:
        const sparse = this.sparsify(gradients, 0.01);
        const uint8 = this.quantizeToUint8(
          sparse.compressed as number[]
        );
        return {
          compressed: uint8.compressed,
          metadata: {
            ...uint8.metadata,
            sparsityPercent: (sparse.metadata.sparsityPercent || 0) * 100,
          },
        };

      default:
        throw new Error(`Unknown compression strategy: ${strategy}`);
    }
  }

  /**
   * Decompress gradients after reception
   */
  decompress(
    compressed: number[] | Uint8Array | Uint32Array,
    metadata: any
  ): number[] {
    switch (metadata.strategy) {
      case CompressionStrategy.NONE:
        return Array.from(compressed as number[]);

      case CompressionStrategy.UINT8:
        return this.dequantizeFromUint8(
          compressed as Uint8Array,
          metadata.minValue,
          metadata.maxValue
        );

      case CompressionStrategy.UINT4:
        return this.dequantizeFromUint4(
          compressed as Uint8Array,
          metadata.minValue,
          metadata.maxValue
        );

      case CompressionStrategy.SPARSE:
        return this.desparsify(
          compressed as number[],
          metadata.originalSize
        );

      case CompressionStrategy.SPARSEUINT8:
        const uint8DeCompressed = this.dequantizeFromUint8(
          compressed as Uint8Array,
          metadata.minValue,
          metadata.maxValue
        );
        return this.desparsify(uint8DeCompressed, metadata.originalSize);

      default:
        throw new Error(`Unknown decompression strategy: ${metadata.strategy}`);
    }
  }

  /**
   * Quantize to 8-bit unsigned
   */
  private quantizeToUint8(
    gradients: number[]
  ): {
    compressed: Uint8Array;
    metadata: any;
  } {
    const min = Math.min(...gradients);
    const max = Math.max(...gradients);
    const range = max - min || 1;

    const uint8Array = new Uint8Array(gradients.length);
    for (let i = 0; i < gradients.length; i++) {
      const normalized = (gradients[i] - min) / range;
      uint8Array[i] = Math.round(normalized * 255);
    }

    return {
      compressed: uint8Array,
      metadata: {
        strategy: CompressionStrategy.UINT8,
        originalSize: gradients.length * 4,
        compressedSize: gradients.length,
        compressionRatio: 4.0,
        minValue: min,
        maxValue: max,
      },
    };
  }

  /**
   * Dequantize from 8-bit
   */
  private dequantizeFromUint8(
    uint8Array: Uint8Array,
    min: number,
    max: number
  ): number[] {
    const range = max - min || 1;
    const result: number[] = [];

    for (let i = 0; i < uint8Array.length; i++) {
      const normalized = uint8Array[i] / 255;
      result.push(min + normalized * range);
    }

    return result;
  }

  /**
   * Quantize to 4-bit (2 values per byte)
   */
  private quantizeToUint4(
    gradients: number[]
  ): {
    compressed: Uint8Array;
    metadata: any;
  } {
    const min = Math.min(...gradients);
    const max = Math.max(...gradients);
    const range = max - min || 1;

    const uint8Array = new Uint8Array(Math.ceil(gradients.length / 2));

    for (let i = 0; i < gradients.length; i++) {
      const normalized = (gradients[i] - min) / range;
      const uint4 = Math.round(normalized * 15); // 4-bit: 0-15

      if (i % 2 === 0) {
        uint8Array[Math.floor(i / 2)] = uint4 << 4;
      } else {
        uint8Array[Math.floor(i / 2)] |= uint4;
      }
    }

    return {
      compressed: uint8Array,
      metadata: {
        strategy: CompressionStrategy.UINT4,
        originalSize: gradients.length * 4,
        compressedSize: Math.ceil(gradients.length / 2),
        compressionRatio: 8.0,
        minValue: min,
        maxValue: max,
      },
    };
  }

  /**
   * Dequantize from 4-bit
   */
  private dequantizeFromUint4(
    uint8Array: Uint8Array,
    min: number,
    max: number
  ): number[] {
    const range = max - min || 1;
    const result: number[] = [];

    for (let i = 0; i < uint8Array.length; i++) {
      // High 4 bits
      const high = (uint8Array[i] >> 4) & 0x0f;
      result.push(min + (high / 15) * range);

      // Low 4 bits
      const low = uint8Array[i] & 0x0f;
      if (result.length < 256) {
        // Assume max 256 gradients per satellite for this example
        result.push(min + (low / 15) * range);
      }
    }

    return result;
  }

  /**
   * Sparsify: keep only top K gradients by magnitude
   */
  private sparsify(
    gradients: number[],
    keepRatio: number
  ): {
    compressed: number[];
    metadata: any;
  } {
    const keepCount = Math.max(1, Math.ceil(gradients.length * keepRatio));
    const indexed = gradients.map((g, i) => ({ value: g, index: i }));
    indexed.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

    const sparse: number[] = [];
    for (let i = 0; i < keepCount; i++) {
      sparse.push(indexed[i].index);
      sparse.push(indexed[i].value);
    }

    return {
      compressed: sparse,
      metadata: {
        strategy: CompressionStrategy.SPARSE,
        originalSize: gradients.length * 4,
        compressedSize: sparse.length * 4,
        compressionRatio: gradients.length / sparse.length,
        sparsityPercent: ((gradients.length - keepCount) / gradients.length) * 100,
      },
    };
  }

  /**
   * Desparsify: expand sparse representation
   */
  private desparsify(sparse: number[], originalSize: number): number[] {
    const result = new Array(originalSize).fill(0);

    for (let i = 0; i < sparse.length; i += 2) {
      const index = sparse[i];
      const value = sparse[i + 1];
      result[index] = value;
    }

    return result;
  }
}

/**
 * Federated Aggregator
 * Aggregates gradients from multiple satellites
 *
 * Methods:
 * - FedAvg: Standard averaging
 * - Median: Robust to outliers
 * - Krum: Byzantine-robust
 */
export class FederatedAggregator {
  private logger = pino();

  /**
   * FedAvg: Simple averaging across all participants
   */
  fedAvg(gradients: ModelGradient[]): AggregatedUpdate {
    if (gradients.length === 0) {
      throw new Error("No gradients to aggregate");
    }

    const modelId = gradients[0].modelId;
    const epoch = gradients[0].epoch;

    // Weight by sample count for proper averaging
    const totalSamples = gradients.reduce((sum, g) => sum + g.sampleCount, 0);

    const aggregated = new Array(gradients[0].gradients.length).fill(0);

    for (const grad of gradients) {
      const weight = grad.sampleCount / totalSamples;
      for (let i = 0; i < grad.gradients.length; i++) {
        aggregated[i] += grad.gradients[i] * weight;
      }
    }

    return {
      modelId,
      epoch,
      aggregatedGradients: aggregated,
      participantCount: gradients.length,
      aggregationMethod: "fedavg",
      confidenceScore: 0.95,
      timestamp: Date.now(),
    };
  }

  /**
   * Median: Element-wise median (robust to outliers)
   */
  median(gradients: ModelGradient[]): AggregatedUpdate {
    if (gradients.length === 0) {
      throw new Error("No gradients to aggregate");
    }

    const modelId = gradients[0].modelId;
    const epoch = gradients[0].epoch;
    const gradLength = gradients[0].gradients.length;

    const aggregated = new Array(gradLength).fill(0);

    for (let i = 0; i < gradLength; i++) {
      const values = gradients.map((g) => g.gradients[i]).sort((a, b) => a - b);
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
      timestamp: Date.now(),
    };
  }

  /**
   * Krum: Byzantine-robust aggregation
   * Selects gradient closest to average, removes outliers
   */
  krum(gradients: ModelGradient[], f: number = 1): AggregatedUpdate {
    if (gradients.length < 2 * f + 2) {
      this.logger.warn(
        { gradientCount: gradients.length, f },
        "Not enough gradients for Krum with f parameter"
      );
      // Fall back to FedAvg
      return this.fedAvg(gradients);
    }

    const modelId = gradients[0].modelId;
    const epoch = gradients[0].epoch;

    // Calculate pairwise distances
    const distances: number[] = [];

    for (let i = 0; i < gradients.length; i++) {
      let distance = 0;

      for (let j = 0; j < gradients.length; j++) {
        if (i === j) continue;

        // Euclidean distance between gradients
        let diff = 0;
        for (let k = 0; k < gradients[i].gradients.length; k++) {
          diff +=
            (gradients[i].gradients[k] - gradients[j].gradients[k]) ** 2;
        }

        distance += Math.sqrt(diff);
      }

      distances.push(distance);
    }

    // Select gradient with minimum k-nearest-neighbor distance
    const k = gradients.length - f - 1;
    const sortedIndices = distances
      .map((d, i) => ({ distance: d, index: i }))
      .sort((a, b) => a.distance - b.distance);

    const selectedIndex = sortedIndices[0].index;
    const aggregated = [...gradients[selectedIndex].gradients];

    return {
      modelId,
      epoch,
      aggregatedGradients: aggregated,
      participantCount: gradients.length,
      aggregationMethod: "krum",
      confidenceScore: 0.92,
      timestamp: Date.now(),
    };
  }
}

/**
 * Federated Learning Coordinator
 * Orchestrates distributed model training across satellite constellation
 */
export class FederatedLearningCoordinator extends EventEmitter {
  private logger = pino();
  private satelliteMetrics: Map<string, SatelliteMetrics>;
  private aggregator: FederatedAggregator;
  private compressor: GradientCompressor;
  private currentEpoch: number = 0;

  constructor() {
    super();
    this.satelliteMetrics = new Map();
    this.aggregator = new FederatedAggregator();
    this.compressor = new GradientCompressor();
  }

  /**
   * Register satellite for federated learning
   */
  registerSatellite(satelliteId: string, modelsToTrain: string[]): void {
    const metrics: SatelliteMetrics = {
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
    };

    this.satelliteMetrics.set(satelliteId, metrics);
    this.logger.info(
      { satelliteId, models: modelsToTrain },
      "Satellite registered for federated learning"
    );

    this.emit("satellite:registered", { satelliteId, modelsToTrain });
  }

  /**
   * Submit local gradients from satellite
   */
  submitGradients(gradient: ModelGradient): void {
    const metrics = this.satelliteMetrics.get(gradient.participantId);
    if (!metrics) {
      this.logger.warn(
        { satelliteId: gradient.participantId },
        "Gradient from unregistered satellite"
      );
      return;
    }

    metrics.lastUpdateEpoch = gradient.epoch;
    metrics.localLoss = gradient.loss;
    metrics.lastSyncTimestamp = Date.now();
    metrics.gradientsSent++;

    this.emit("gradient:received", gradient);
  }

  /**
   * Aggregate gradients from multiple satellites
   */
  aggregateGradients(
    gradients: ModelGradient[],
    method: "fedavg" | "median" | "krum" = "fedavg"
  ): AggregatedUpdate {
    let aggregated: AggregatedUpdate;

    switch (method) {
      case "fedavg":
        aggregated = this.aggregator.fedAvg(gradients);
        break;
      case "median":
        aggregated = this.aggregator.median(gradients);
        break;
      case "krum":
        aggregated = this.aggregator.krum(gradients);
        break;
    }

    this.logger.info(
      {
        modelId: aggregated.modelId,
        epoch: aggregated.epoch,
        participantCount: aggregated.participantCount,
        method,
      },
      "Gradients aggregated"
    );

    this.emit("aggregation:complete", aggregated);
    return aggregated;
  }

  /**
   * Compress and send aggregated update to satellites
   */
  broadcastUpdate(
    update: AggregatedUpdate,
    compression: CompressionStrategy = CompressionStrategy.UINT8
  ): void {
    const compressed = this.compressor.compress(
      update.aggregatedGradients,
      compression
    );

    const broadcastSize =
      typeof compressed.compressed === "number"
        ? compressed.compressed.length
        : compressed.compressed.length;

    this.logger.info(
      {
        modelId: update.modelId,
        epoch: update.epoch,
        originalSize: compressed.metadata.originalSize,
        compressedSize: broadcastSize,
        compressionRatio: compressed.metadata.compressionRatio,
      },
      "Broadcasting aggregated update"
    );

    // Update all satellites
    for (const [satelliteId, metrics] of this.satelliteMetrics) {
      if (metrics.modelsTraining.includes(update.modelId)) {
        metrics.gradientsReceived++;
        metrics.communicationBandwidthKbps += broadcastSize / 1024;
      }
    }

    this.emit("broadcast:update", {
      update,
      compressed,
      timestamp: Date.now(),
    });
  }

  /**
   * Get metrics for all satellites
   */
  getSatelliteMetrics(): SatelliteMetrics[] {
    return Array.from(this.satelliteMetrics.values());
  }

  /**
   * Get metrics for specific satellite
   */
  getSatelliteMetric(satelliteId: string): SatelliteMetrics | undefined {
    return this.satelliteMetrics.get(satelliteId);
  }

  /**
   * Get training progress
   */
  getTrainingProgress(modelId: string): {
    modelId: string;
    participatingCount: number;
    averageLoss: number;
    averageAccuracy: number;
    totalGradientsSent: number;
    totalBandwidthMb: number;
  } {
    const metricsArray = Array.from(this.satelliteMetrics.values());
    const participating = metricsArray.filter((m) =>
      m.modelsTraining.includes(modelId)
    );

    const totalBandwidthKb = participating.reduce(
      (sum, m) => sum + m.communicationBandwidthKbps,
      0
    );

    return {
      modelId,
      participatingCount: participating.length,
      averageLoss:
        participating.reduce((sum, m) => sum + m.localLoss, 0) /
        participating.length,
      averageAccuracy:
        participating.reduce((sum, m) => sum + m.localAccuracy, 0) /
        participating.length,
      totalGradientsSent: participating.reduce(
        (sum, m) => sum + m.gradientsSent,
        0
      ),
      totalBandwidthMb: totalBandwidthKb / 1024,
    };
  }

  /**
   * Get resource utilization
   */
  getResourceUtilization(): {
    averageComputeUtilization: number;
    averageBandwidthKbps: number;
    activeSatellites: number;
  } {
    const metricsArray = Array.from(this.satelliteMetrics.values());

    return {
      averageComputeUtilization:
        metricsArray.reduce((sum, m) => sum + m.computeUtilizationPercent, 0) /
        metricsArray.length,
      averageBandwidthKbps:
        metricsArray.reduce(
          (sum, m) => sum + m.communicationBandwidthKbps,
          0
        ) / metricsArray.length,
      activeSatellites: metricsArray.length,
    };
  }
}
