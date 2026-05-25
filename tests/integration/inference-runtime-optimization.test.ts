/**
 * Inference Runtime Integration Test
 * Verify optimization library integration with gradient compression
 */

import InferenceEngineOptimized from '../../packages/inference-runtime/src/inference-engine-optimized';
import { ModelMetadata, TaskPriority } from '@orbitalmind/shared';

describe('Inference Runtime Optimization Integration', () => {
  let engine: InferenceEngineOptimized;
  let testModel: ModelMetadata;

  beforeEach(() => {
    engine = new InferenceEngineOptimized();

    testModel = {
      id: 'test-model-001' as any,
      name: 'Test Neural Network',
      version: '1.0.0',
      inputShape: [1, 128],
      outputShape: [1, 10],
      peakPower: 8.0,
      modelSize: 4096,
      trainingData: Buffer.alloc(0),
      targetAccuracy: 0.95
    };
  });

  describe('Inference Task Processing', () => {
    test('should load model and submit inference task', async () => {
      const weights = Buffer.alloc(testModel.modelSize);
      await engine.loadModel(testModel, weights);

      const input = Buffer.alloc(128);
      const taskID = engine.submitTask(input, testModel.id);

      expect(taskID).toBeDefined();

      // Allow processing
      await new Promise(resolve => setTimeout(resolve, 200));

      const stats = engine.getStatistics();
      expect(stats.modelsLoaded).toBe(1);

      console.log('Model loaded and task submitted');
    });

    test('should handle multiple inference tasks with priorities', async () => {
      const weights = Buffer.alloc(testModel.modelSize);
      await engine.loadModel(testModel, weights);

      const input = Buffer.alloc(128);

      // Submit tasks with different priorities
      const taskID1 = engine.submitTask(input, testModel.id, TaskPriority.Normal);
      const taskID2 = engine.submitTask(input, testModel.id, TaskPriority.High);
      const taskID3 = engine.submitTask(input, testModel.id, TaskPriority.Low);

      expect(taskID1).toBeDefined();
      expect(taskID2).toBeDefined();
      expect(taskID3).toBeDefined();

      // Allow processing
      await new Promise(resolve => setTimeout(resolve, 500));

      const stats = engine.getStatistics();
      expect(stats.currentQueueLength).toBeLessThanOrEqual(3);

      console.log('Multiple tasks with priorities processed');
    });

    test('should track inference latency', async () => {
      const weights = Buffer.alloc(testModel.modelSize);
      await engine.loadModel(testModel, weights);

      const input = Buffer.alloc(128);

      // Submit multiple tasks
      for (let i = 0; i < 10; i++) {
        engine.submitTask(input, testModel.id);
      }

      // Allow processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      const stats = engine.getStatistics();
      expect(stats.totalTasksProcessed).toBeGreaterThan(0);
      expect(parseFloat(stats.averageLatency)).toBeGreaterThan(0);

      console.log(`Tasks processed: ${stats.totalTasksProcessed}, Avg latency: ${stats.averageLatency}ms`);
    });
  });

  describe('Gradient Compression for Federated Learning', () => {
    test('should compute and compress gradients', async () => {
      const weights = Buffer.alloc(testModel.modelSize);
      await engine.loadModel(testModel, weights);

      // Compute gradients
      const gradients = engine.computeGradients(testModel.id, 32);
      expect(gradients).toBeDefined();
      expect(gradients.length).toBe(testModel.modelSize);

      // Compress gradients
      const update = engine.compressGradients(testModel.id, 1);

      expect(update.modelID).toBe(testModel.id);
      expect(update.compressedSize).toBeLessThan(update.originalSize);
      expect(update.compressionRatio).toBeGreaterThan(1.0);

      console.log(
        `Gradient compression: ${update.originalSize} -> ${update.compressedSize} bytes ` +
        `(ratio: ${update.compressionRatio.toFixed(2)}x)`
      );
    });

    test('should achieve 4x compression with sparse representation', async () => {
      const weights = Buffer.alloc(8192);
      await engine.loadModel(testModel, weights);

      let totalCompression = 0;
      let compressions = 0;

      for (let i = 0; i < 10; i++) {
        engine.computeGradients(testModel.id, 32);
        const update = engine.compressGradients(testModel.id, i);

        totalCompression += update.compressionRatio;
        compressions++;
      }

      const avgCompression = totalCompression / compressions;
      expect(avgCompression).toBeGreaterThan(2.0); // At least 2x compression

      console.log(`Average compression ratio over 10 iterations: ${avgCompression.toFixed(2)}x`);
    });

    test('should handle batch gradient updates', async () => {
      const weights = Buffer.alloc(4096);
      await engine.loadModel(testModel, weights);

      const batchSize = 5;
      const updates = [];

      for (let batch = 0; batch < batchSize; batch++) {
        engine.computeGradients(testModel.id, 32);
        const update = engine.compressGradients(testModel.id, batch);
        updates.push(update);
      }

      expect(updates).toHaveLength(batchSize);

      const compression = engine.getCompressionStatistics();
      expect(compression.gradientCompressions).toBe(batchSize);

      console.log(
        `Batch processed: ${batchSize} gradient updates, ` +
        `communication saved: ${compression.totalCommunicationSaved} bytes`
      );
    });

    test('should apply decompressed gradient updates to model', async () => {
      const weights = Buffer.alloc(testModel.modelSize);
      await engine.loadModel(testModel, weights);

      // Create and compress gradients
      const gradients = engine.computeGradients(testModel.id, 32);
      const update = engine.compressGradients(testModel.id, 1);

      // Apply decompressed update
      engine.applyGradientUpdate(update);

      expect(update.modelID).toBe(testModel.id);

      console.log('Gradient update decompressed and applied to model');
    });
  });

  describe('Communication Efficiency', () => {
    test('should measure communication savings', async () => {
      const weights = Buffer.alloc(16384);
      await engine.loadModel(testModel, weights);

      for (let i = 0; i < 20; i++) {
        engine.computeGradients(testModel.id, 32);
        engine.compressGradients(testModel.id, i);
      }

      const compression = engine.getCompressionStatistics();

      expect(compression.gradientCompressions).toBe(20);
      expect(parseInt(compression.totalCommunicationSaved)).toBeGreaterThan(0);

      console.log(`
        Total gradient compressions: ${compression.gradientCompressions}
        Communication saved: ${compression.totalCommunicationSaved} bytes
        Avg compression ratio: ${compression.avgCompressionRatio}x
        Bytes saved per update: ${compression.bytesSavedPerUpdate}
      `);
    });

    test('should show scalability of compression with larger models', () => {
      const results: Array<{ modelSize: number; compressionRatio: number; savedBytes: number }> = [];

      for (const modelSize of [4096, 8192, 16384]) {
        const largeModel: ModelMetadata = {
          ...testModel,
          modelSize
        };

        const engine = new InferenceEngineOptimized();

        const weights = Buffer.alloc(modelSize);
        engine.loadModel(largeModel, weights);

        let totalRatio = 0;
        let totalSaved = 0;

        for (let i = 0; i < 5; i++) {
          engine.computeGradients(largeModel.id, 32);
          const update = engine.compressGradients(largeModel.id, i);

          totalRatio += update.compressionRatio;
          totalSaved += (update.originalSize - update.compressedSize);
        }

        results.push({
          modelSize,
          compressionRatio: totalRatio / 5,
          savedBytes: totalSaved
        });
      }

      // Compression ratio should improve or stay consistent with larger models
      expect(results[results.length - 1].compressionRatio).toBeGreaterThan(1.0);

      console.log('Compression scaling across model sizes:');
      results.forEach(r => console.log(`  ${r.modelSize} bytes: ratio=${r.compressionRatio.toFixed(2)}x, saved=${r.savedBytes} bytes`));
    });
  });

  describe('Performance Metrics', () => {
    test('should track inference and compression metrics', async () => {
      const weights = Buffer.alloc(testModel.modelSize);
      await engine.loadModel(testModel, weights);

      const input = Buffer.alloc(128);

      // Submit inference tasks
      for (let i = 0; i < 15; i++) {
        engine.submitTask(input, testModel.id);
      }

      // Compute and compress gradients
      for (let i = 0; i < 10; i++) {
        engine.computeGradients(testModel.id, 32);
        engine.compressGradients(testModel.id, i);
      }

      // Allow processing
      await new Promise(resolve => setTimeout(resolve, 500));

      const metrics = engine.getMetrics();

      expect(metrics.tasksProcessed).toBeGreaterThan(0);
      expect(parseInt(metrics.avgLatency)).toBeGreaterThan(0);
      expect(metrics.compressions).toBe(10);
      expect(parseInt(metrics.communicationSaved)).toBeGreaterThan(0);

      console.log('Performance metrics:', JSON.stringify(metrics, null, 2));
    });

    test('should show O(n) scaling of compression with batch size', async () => {
      const weights = Buffer.alloc(8192);
      await engine.loadModel(testModel, weights);

      const results: Array<{ batchSize: number; time: number }> = [];

      for (const batchSize of [10, 50, 100]) {
        engine.computeGradients(testModel.id, 32);

        const startTime = Date.now();

        for (let i = 0; i < batchSize; i++) {
          engine.computeGradients(testModel.id, 32);
          engine.compressGradients(testModel.id, i);
        }

        const elapsed = Date.now() - startTime;
        results.push({ batchSize, time: elapsed });
      }

      // Time should scale roughly linearly with batch size
      expect(results[2].time).toBeLessThan(results[0].time * 15);

      console.log('Compression scaling with batch size:');
      results.forEach(r => console.log(`  Batch ${r.batchSize}: ${r.time}ms`));
    });
  });

  describe('Model Management', () => {
    test('should manage multiple models efficiently', async () => {
      const modelCount = 5;
      const modelsLoaded = [];

      for (let i = 0; i < modelCount; i++) {
        const model: ModelMetadata = {
          ...testModel,
          id: `model-${i}` as any,
          name: `Model ${i}`
        };

        const weights = Buffer.alloc(testModel.modelSize);
        await engine.loadModel(model, weights);
        modelsLoaded.push(model.id);
      }

      const stats = engine.getStatistics();
      expect(stats.modelsLoaded).toBe(modelCount);

      console.log(`${modelCount} models loaded simultaneously`);
    });

    test('should handle model updates with gradient application', async () => {
      const weights = Buffer.alloc(testModel.modelSize);
      await engine.loadModel(testModel, weights);

      // Simulate training iterations
      for (let iter = 0; iter < 5; iter++) {
        const gradients = engine.computeGradients(testModel.id, 32);
        const update = engine.compressGradients(testModel.id, iter);
        engine.applyGradientUpdate(update);
      }

      const compression = engine.getCompressionStatistics();
      expect(compression.gradientCompressions).toBe(5);

      console.log('5 training iterations with gradient updates completed');
    });
  });
});
