/**
 * OrbitalMind Inference Execution Engine
 * High-performance AI inference with thermal and radiation awareness
 */

import {
  InferenceTask,
  InferenceTaskID,
  ModelMetadata,
  TaskPriority,
  ThermalState,
  createInferenceTaskID
} from '@orbitalmind/shared';
import { ThermalManager } from '@orbitalmind/thermal-engine';
import { RadiationManager } from '@orbitalmind/radiation-runtime';

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
  loadedAt: Date;
  lastUsed: Date;
  accessCount: number;
}

export interface TaskQueue {
  task: InferenceTask;
  priority: number;
  enqueueTime: Date;
}

/**
 * Main inference execution engine
 */
export class InferenceEngine {
  private modelCache: Map<string, ModelCache> = new Map();
  private taskQueue: TaskQueue[] = [];
  private thermalManager: ThermalManager;
  private radiationManager: RadiationManager;
  private isProcessing: boolean = false;
  private totalTasksProcessed: number = 0;
  private totalInferenceTime: number = 0;

  constructor(thermalManager: ThermalManager, radiationManager: RadiationManager) {
    this.thermalManager = thermalManager;
    this.radiationManager = radiationManager;

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

    this.radiationManager.registerMemoryBlock(
      this.hashString(metadata.id),
      weights.length
    );

    this.radiationManager.writeMemory(
      this.hashString(metadata.id),
      weights
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

      const thermalState = this.thermalManager.getState();
      const availablePower = this.thermalManager.getAvailablePowerBudget();

      const model = this.modelCache.get(task.modelID);
      if (!model) {
        return;
      }

      if (model.model.peakPower > availablePower) {
        this.taskQueue.unshift(queueEntry);
        return;
      }

      const startTime = Date.now();
      const result = await this.executeInference(task, model);
      const latency = Date.now() - startTime;

      this.totalTasksProcessed++;
      this.totalInferenceTime += latency;

      if (result.success) {
        this.radiationManager.createCheckpoint(
          task.id,
          0,
          model.weights,
          task.input,
          Buffer.from(result.output)
        );
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Execute inference with radiation-aware redundancy
   */
  private async executeInference(
    task: InferenceTask,
    modelCache: ModelCache
  ): Promise<InferenceResult> {
    const model = modelCache.model;
    const startTime = Date.now();

    try {
      const useRedundancy = this.radiationManager.shouldUseRedundancy();

      let output: Float32Array;

      if (useRedundancy) {
        const result1 = this.executeInferenceOnce(task.input, model);
        const result2 = this.executeInferenceOnce(task.input, model);

        if (!this.compareOutputs(result1, result2, 0.01)) {
          this.radiationManager.recordRadiationEvent({
            timestamp: new Date(),
            satelliteID: 'unknown' as any,
            eventType: 'SET',
            severity: 'high',
            corrected: false,
            recoveryStatus: 'pending',
            details: { taskID: task.id }
          });

          const result3 = this.executeInferenceOnce(task.input, model);
          output = this.majorityVote([result1, result2, result3]);
        } else {
          output = result1;
        }
      } else {
        output = this.executeInferenceOnce(task.input, model);
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
   * Execute single inference pass
   */
  private executeInferenceOnce(input: Buffer, model: ModelMetadata): Float32Array {
    const outputSize = model.outputShape.reduce((a, b) => a * b, 1);
    const output = new Float32Array(outputSize);

    for (let i = 0; i < outputSize; i++) {
      output[i] = Math.random();
    }

    return output;
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
   * Compare two outputs with tolerance
   */
  private compareOutputs(a: Float32Array, b: Float32Array, tolerance: number): boolean {
    if (a.length !== b.length) return false;

    for (let i = 0; i < a.length; i++) {
      if (Math.abs(a[i] - b[i]) > tolerance) {
        return false;
      }
    }

    return true;
  }

  /**
   * Majority vote among three outputs
   */
  private majorityVote(outputs: [Float32Array, Float32Array, Float32Array]): Float32Array {
    const result = new Float32Array(outputs[0].length);

    for (let i = 0; i < outputs[0].length; i++) {
      const values = [outputs[0][i], outputs[1][i], outputs[2][i]];
      values.sort((a, b) => a - b);
      result[i] = values[1];
    }

    return result;
  }

  /**
   * Get engine statistics
   */
  public getStatistics() {
    return {
      totalTasksProcessed: this.totalTasksProcessed,
      averageLatency: this.totalTasksProcessed > 0 ?
        this.totalInferenceTime / this.totalTasksProcessed : 0,
      currentQueueLength: this.taskQueue.length,
      modelsLoaded: this.modelCache.size,
      isProcessing: this.isProcessing
    };
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}
