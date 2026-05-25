/**
 * Optimized Inference Execution Engine
 *
 * Uses gradient compression for 4x reduction in federated learning communication
 * Enables efficient on-board training and model synchronization
 */

import pino from "pino";
import { OptimizedGradientCompressor } from "@orbitalmind/optimization-lib";
import {
  InferenceTask,
  InferenceTaskID,
  ModelMetadata,
  TaskPriority,
  ThermalState,
  createInferenceTaskID
} from '@orbitalmind/shared';

export interface InferenceResult {
  taskID: InferenceTaskID;
  output: Float32Array | Buffer;
  latency: number;
  timestamp: Date;
  success: boolean;
  error?: string;
}

export interface ModelCache {
  model: ModelMetadata;
  weights: Buffer;
  gradients?: Buffer;
  compressedGradients?: Buffer;
  loadedAt: Date;
  lastUsed: Date;
  accessCount: number;
}

export interface TaskQueue {
  task: InferenceTask;
  priority: number;
  enqueueTime: Date;
}

export interface GradientUpdate {
  modelID: string;
  iteration: number;
  compressedGradients: Buffer;
  compressionRatio: number;
  originalSize: number;
  compressedSize: number;
  timestamp: Date;
}

/**
 * Optimized inference execution engine with gradient compression
 */
export class InferenceEngineOptimized {
  private logger = pino();
  private modelCache: Map<string, ModelCache> = new Map();
  private taskQueue: TaskQueue[] = [];
  private isProcessing: boolean = false;
  private totalTasksProcessed: number = 0;
  private totalInferenceTime: number = 0;
  private gradientCompressor: OptimizedGradientCompressor;
  private gradientHistory: GradientUpdate[] = [];

  // Performance metrics
  private metrics = {
    tasksProcessed: 0,
    avgLatency: 0,
    gradientCompressions: 0,
    totalCommunicationSaved: 0,
    compressionRatio: 1.0
  };

  constructor() {
    this.logger = pino();
    this.gradientCompressor = new OptimizedGradientCompressor();
    this.startTaskProcessor();
  }

  /**
   * Load a model into cache
   */
  public async loadModel(metadata: ModelMetadata, weights: Buffer): Promise<void> {
    const cache: ModelCache = {
      model: metadata,
      weights,
      loadedAt: new Date(),
      lastUsed: new Date(),
      accessCount: 0
    };

    this.modelCache.set(metadata.id, cache);

    this.logger.debug(
      { modelID: metadata.id, size: weights.length },
      "Model loaded"
    );
  }

  /**
   * Submit an inference task
   */
  public submitTask(input: Buffer, modelID: string, priority: TaskPriority = TaskPriority.Normal): InferenceTaskID {
    const taskID = createInferenceTaskID(`inference-${Date.now()}-${Math.random()}`);

    const task: InferenceTask = {
      id: taskID,
      modelID: modelID as any,
      input,
      priority,
      createdAt: new Date()
    };

    const queueEntry: TaskQueue = {
      task,
      priority,
      enqueueTime: new Date()
    };

    // Insert by priority
    let inserted = false;
    for (let i = 0; i < this.taskQueue.length; i++) {
      if (priority > this.taskQueue[i].priority) {
        this.taskQueue.splice(i, 0, queueEntry);
        inserted = true;
        break;
      }
    }

    if (!inserted) {
      this.taskQueue.push(queueEntry);
    }

    return taskID;
  }

  /**
   * Start background task processor
   */
  private startTaskProcessor(): void {
    setInterval(() => {
      this.processNextTask();
    }, 100);
  }

  /**
   * Process next task in queue
   */
  private async processNextTask(): Promise<void> {
    if (this.isProcessing || this.taskQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      const queueEntry = this.taskQueue.shift();
      if (!queueEntry) return;

      const task = queueEntry.task;
      const model = this.modelCache.get(task.modelID);

      if (!model) {
        this.logger.warn({ modelID: task.modelID }, "Model not loaded");
        return;
      }

      const startTime = Date.now();
      const result = await this.executeInference(task, model);
      const latency = Date.now() - startTime;

      this.metrics.tasksProcessed++;
      this.metrics.avgLatency =
        (this.metrics.avgLatency * 0.9) + (latency * 0.1);

      if (result.success) {
        model.lastUsed = new Date();
        model.accessCount++;
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Execute inference
   */
  private async executeInference(
    task: InferenceTask,
    modelCache: ModelCache
  ): Promise<InferenceResult> {
    const startTime = Date.now();

    try {
      const model = modelCache.model;
      const outputSize = model.outputShape.reduce((a, b) => a * b, 1);
      const output = new Float32Array(outputSize);

      // Simulate inference
      for (let i = 0; i < outputSize; i++) {
        output[i] = Math.random();
      }

      if (!this.validateOutput(output, model)) {
        return {
          taskID: task.id,
          output: Buffer.alloc(0),
          latency: Date.now() - startTime,
          timestamp: new Date(),
          success: false,
          error: 'Output validation failed'
        };
      }

      return {
        taskID: task.id,
        output,
        latency: Date.now() - startTime,
        timestamp: new Date(),
        success: true
      };
    } catch (error) {
      return {
        taskID: task.id,
        output: Buffer.alloc(0),
        latency: Date.now() - startTime,
        timestamp: new Date(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Compute gradients for model training (simulated)
   */
  public computeGradients(modelID: string, batchSize: number): Buffer {
    const model = this.modelCache.get(modelID);
    if (!model) {
      throw new Error(`Model not found: ${modelID}`);
    }

    // Simulate gradient computation
    const gradients = Buffer.alloc(model.weights.length);
    for (let i = 0; i < model.weights.length; i++) {
      gradients[i] = Math.floor(Math.random() * 256);
    }

    model.gradients = gradients;
    return gradients;
  }

  /**
   * Compress gradients for federated learning communication
   * 4x compression using sparse representation and quantization
   */
  public compressGradients(modelID: string, iteration: number): GradientUpdate {
    const startTime = Date.now();

    const model = this.modelCache.get(modelID);
    if (!model || !model.gradients) {
      throw new Error(`Model or gradients not found: ${modelID}`);
    }

    const originalSize = model.gradients.length;

    // Use optimized gradient compression
    const compressionResult = this.gradientCompressor.compressSparse(
      model.gradients
    );

    const update: GradientUpdate = {
      modelID,
      iteration,
      compressedGradients: compressionResult.compressedData,
      compressionRatio: compressionResult.ratio,
      originalSize,
      compressedSize: compressionResult.compressedData.length,
      timestamp: new Date()
    };

    this.gradientHistory.push(update);

    // Keep last 100 gradient updates
    if (this.gradientHistory.length > 100) {
      this.gradientHistory.shift();
    }

    this.metrics.gradientCompressions++;
    const communicationSaved = originalSize - compressionResult.compressedData.length;
    this.metrics.totalCommunicationSaved += communicationSaved;
    this.metrics.compressionRatio = compressionResult.ratio;

    const elapsed = Date.now() - startTime;

    this.logger.info(
      {
        modelID,
        iteration,
        originalSize,
        compressedSize: compressionResult.compressedData.length,
        ratio: compressionResult.ratio.toFixed(2),
        savedBytes: communicationSaved,
        timeMs: elapsed
      },
      "Gradients compressed"
    );

    return update;
  }

  /**
   * Decompress and apply gradient updates
   */
  public applyGradientUpdate(update: GradientUpdate): void {
    const model = this.modelCache.get(update.modelID);
    if (!model) {
      throw new Error(`Model not found: ${update.modelID}`);
    }

    // Decompress gradients
    const decompressed = this.gradientCompressor.decompressSparse(
      update.compressedGradients,
      model.weights.length
    );

    // Apply gradients to model weights (simple update for now)
    const learningRate = 0.01;
    for (let i = 0; i < model.weights.length; i++) {
      const gradient = decompressed[i] / 255; // Normalize from uint8
      model.weights[i] = Math.max(0, Math.min(255,
        model.weights[i] - (gradient * learningRate * 255)
      ));
    }

    this.logger.debug(
      { modelID: update.modelID, iteration: update.iteration },
      "Gradient update applied"
    );
  }

  /**
   * Validate inference output
   */
  private validateOutput(output: Float32Array, model: ModelMetadata): boolean {
    const expectedSize = model.outputShape.reduce((a, b) => a * b, 1);
    if (output.length !== expectedSize) {
      return false;
    }

    for (const value of output) {
      if (!isFinite(value)) {
        return false;
      }
    }

    for (const value of output) {
      if (Math.abs(value) > 1000) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get engine statistics
   */
  public getStatistics() {
    return {
      totalTasksProcessed: this.metrics.tasksProcessed,
      averageLatency: this.metrics.avgLatency.toFixed(2),
      currentQueueLength: this.taskQueue.length,
      modelsLoaded: this.modelCache.size,
      isProcessing: this.isProcessing
    };
  }

  /**
   * Get compression statistics
   */
  public getCompressionStatistics() {
    return {
      gradientCompressions: this.metrics.gradientCompressions,
      totalCommunicationSaved: this.metrics.totalCommunicationSaved,
      avgCompressionRatio: this.metrics.compressionRatio.toFixed(2),
      bytesSavedPerUpdate: this.metrics.gradientCompressions > 0 ?
        (this.metrics.totalCommunicationSaved / this.metrics.gradientCompressions).toFixed(0) : '0'
    };
  }

  /**
   * Get performance metrics
   */
  public getMetrics() {
    return {
      tasksProcessed: this.metrics.tasksProcessed,
      avgLatency: this.metrics.avgLatency.toFixed(2),
      compressions: this.metrics.gradientCompressions,
      communicationSaved: this.metrics.totalCommunicationSaved,
      compressionRatio: this.metrics.compressionRatio.toFixed(2)
    };
  }
}

export default InferenceEngineOptimized;
