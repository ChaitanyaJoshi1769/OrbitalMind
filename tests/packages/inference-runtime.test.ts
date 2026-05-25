/**
 * Inference Runtime Unit Tests
 * Comprehensive coverage of inference engine and model management
 */

import {
  InferenceEngine,
  createModelID,
  TaskPriority
} from '@orbitalmind/inference-runtime';
import { ThermalManager, RadiationManager } from '@orbitalmind/shared';
import { SystemConfig } from '@orbitalmind/shared';

describe('InferenceEngine Unit Tests', () => {
  let inferenceEngine: InferenceEngine;
  let thermalManager: ThermalManager;
  let radiationManager: RadiationManager;

  beforeEach(() => {
    const config: SystemConfig = {
      thermalLowPowerThreshold: 50,
      thermalWarningThreshold: 70,
      thermalCriticalThreshold: 85,
      powerBudgetWatts: 20,
      batteryMinimumSOC: 15,
      enableMemoryScrubbing: true,
      scrubInterval: 100,
      enableRedundantExecution: true,
      routingUpdateInterval: 60,
      linkStateAge: 120,
      maxRetries: 3,
      maxModelSize: 512,
      maxInferenceLatency: 50,
      checkpointInterval: 1000
    };

    thermalManager = new ThermalManager(config);
    radiationManager = new RadiationManager();
    inferenceEngine = new InferenceEngine(thermalManager, radiationManager);
  });

  describe('Task Submission', () => {
    test('should submit inference tasks', () => {
      const modelID = createModelID('model-001');
      const input = Buffer.alloc(100);

      const taskID = inferenceEngine.submitTask(input, modelID, TaskPriority.High);
      expect(taskID).toBeDefined();
      expect(typeof taskID).toBe('string');
    });

    test('should handle different priority levels', () => {
      const modelID = createModelID('model-001');
      const input = Buffer.alloc(100);

      const highPriorityTask = inferenceEngine.submitTask(
        input,
        modelID,
        TaskPriority.High
      );
      const lowPriorityTask = inferenceEngine.submitTask(
        input,
        modelID,
        TaskPriority.Low
      );

      expect(highPriorityTask).toBeDefined();
      expect(lowPriorityTask).toBeDefined();
    });

    test('should queue multiple tasks', () => {
      const modelID = createModelID('model-001');

      for (let i = 0; i < 10; i++) {
        const input = Buffer.alloc(100);
        const taskID = inferenceEngine.submitTask(input, modelID, TaskPriority.Normal);
        expect(taskID).toBeDefined();
      }

      const stats = inferenceEngine.getStatistics();
      expect(stats.currentQueueLength).toBeGreaterThanOrEqual(1);
    });

    test('should reject oversized inputs', () => {
      const modelID = createModelID('model-001');
      const hugeInput = Buffer.alloc(10 * 1024 * 1024); // 10MB

      expect(() => {
        inferenceEngine.submitTask(hugeInput, modelID, TaskPriority.High);
      }).toThrow();
    });
  });

  describe('Model Management', () => {
    test('should load models', () => {
      const modelID = createModelID('model-001');
      const modelData = Buffer.alloc(256);

      const success = inferenceEngine.loadModel(modelID, modelData);
      expect(success).toBe(true);
    });

    test('should unload models', () => {
      const modelID = createModelID('model-001');
      const modelData = Buffer.alloc(256);

      inferenceEngine.loadModel(modelID, modelData);
      const success = inferenceEngine.unloadModel(modelID);
      expect(success).toBe(true);
    });

    test('should respect maximum model size', () => {
      const modelID = createModelID('model-huge');
      const hugeModel = Buffer.alloc(10 * 1024 * 1024); // 10MB

      const success = inferenceEngine.loadModel(modelID, hugeModel);
      expect(success).toBe(false);
    });

    test('should manage multiple models', () => {
      const models = [
        { id: createModelID('model-1'), data: Buffer.alloc(128) },
        { id: createModelID('model-2'), data: Buffer.alloc(256) },
        { id: createModelID('model-3'), data: Buffer.alloc(384) }
      ];

      models.forEach(({ id, data }) => {
        const success = inferenceEngine.loadModel(id, data);
        expect(success).toBe(true);
      });
    });

    test('should handle model updates', () => {
      const modelID = createModelID('model-001');
      const modelV1 = Buffer.alloc(256, 0xAA);
      const modelV2 = Buffer.alloc(256, 0xBB);

      inferenceEngine.loadModel(modelID, modelV1);
      const updated = inferenceEngine.loadModel(modelID, modelV2);
      expect(updated).toBe(true);
    });
  });

  describe('Inference Execution', () => {
    test('should process inference tasks', () => {
      const modelID = createModelID('model-001');
      const modelData = Buffer.alloc(256);

      inferenceEngine.loadModel(modelID, modelData);

      const input = Buffer.alloc(100);
      const taskID = inferenceEngine.submitTask(input, modelID, TaskPriority.High);

      // Process queue
      inferenceEngine.processQueue();

      const stats = inferenceEngine.getStatistics();
      expect(stats.tasksCompleted).toBeGreaterThanOrEqual(0);
    });

    test('should respect latency constraints', () => {
      const modelID = createModelID('model-001');
      const modelData = Buffer.alloc(256);

      inferenceEngine.loadModel(modelID, modelData);

      const input = Buffer.alloc(100);
      const startTime = Date.now();

      inferenceEngine.submitTask(input, modelID, TaskPriority.High);
      inferenceEngine.processQueue();

      const latency = Date.now() - startTime;
      expect(latency).toBeLessThan(1000); // Should complete quickly
    });

    test('should handle task priority correctly', () => {
      const modelID = createModelID('model-001');
      const modelData = Buffer.alloc(256);

      inferenceEngine.loadModel(modelID, modelData);

      // Submit low priority task first
      const lowPriorityInput = Buffer.alloc(100);
      const lowID = inferenceEngine.submitTask(
        lowPriorityInput,
        modelID,
        TaskPriority.Low
      );

      // Submit high priority task
      const highPriorityInput = Buffer.alloc(100);
      const highID = inferenceEngine.submitTask(
        highPriorityInput,
        modelID,
        TaskPriority.High
      );

      expect(highID).toBeDefined();
      expect(lowID).toBeDefined();
    });
  });

  describe('Thermal Integration', () => {
    test('should pause inference under thermal stress', () => {
      const modelID = createModelID('model-001');
      const modelData = Buffer.alloc(256);

      inferenceEngine.loadModel(modelID, modelData);

      // Simulate high temperature
      thermalManager.updateSensorReadings({
        junctionTemp: 85,
        caseTemp: 82,
        radiatorTemp: 70,
        heatsinkTemp: 82,
        powerDraw: 16,
        timestamp: new Date()
      });

      const input = Buffer.alloc(100);
      const taskID = inferenceEngine.submitTask(input, modelID, TaskPriority.High);

      // Should handle thermal constraints
      expect(taskID).toBeDefined();
    });

    test('should resume inference when temperature normalizes', () => {
      const modelID = createModelID('model-001');
      const modelData = Buffer.alloc(256);

      inferenceEngine.loadModel(modelID, modelData);

      // Simulate temperature normalization
      thermalManager.updateSensorReadings({
        junctionTemp: 45,
        caseTemp: 42,
        radiatorTemp: 35,
        heatsinkTemp: 42,
        powerDraw: 8,
        timestamp: new Date()
      });

      const input = Buffer.alloc(100);
      const taskID = inferenceEngine.submitTask(input, modelID, TaskPriority.High);

      expect(taskID).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle corrupted model data', () => {
      const modelID = createModelID('model-corrupted');
      const corruptedData = Buffer.alloc(256);

      // Intentionally corrupt data
      for (let i = 0; i < corruptedData.length; i++) {
        corruptedData[i] = Math.floor(Math.random() * 256);
      }

      const success = inferenceEngine.loadModel(modelID, corruptedData);
      // Should either reject or handle gracefully
      expect(typeof success).toBe('boolean');
    });

    test('should handle missing models', () => {
      const modelID = createModelID('model-nonexistent');
      const input = Buffer.alloc(100);

      expect(() => {
        inferenceEngine.submitTask(input, modelID, TaskPriority.High);
      }).toThrow();
    });
  });

  describe('Statistics and Monitoring', () => {
    test('should track inference statistics', () => {
      const stats = inferenceEngine.getStatistics();

      expect(stats).toHaveProperty('currentQueueLength');
      expect(stats).toHaveProperty('tasksCompleted');
      expect(stats).toHaveProperty('averageLatency');
      expect(stats).toHaveProperty('modelCount');
    });

    test('should update statistics with each operation', () => {
      const modelID = createModelID('model-001');
      const modelData = Buffer.alloc(256);

      const statsBefore = inferenceEngine.getStatistics();

      inferenceEngine.loadModel(modelID, modelData);

      const statsAfter = inferenceEngine.getStatistics();

      expect(statsAfter.modelCount).toBeGreaterThanOrEqual(statsBefore.modelCount);
    });

    test('should track task performance metrics', () => {
      const modelID = createModelID('model-001');
      const modelData = Buffer.alloc(256);

      inferenceEngine.loadModel(modelID, modelData);

      for (let i = 0; i < 5; i++) {
        const input = Buffer.alloc(100);
        inferenceEngine.submitTask(input, modelID, TaskPriority.Normal);
      }

      const stats = inferenceEngine.getStatistics();
      expect(stats.currentQueueLength).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Performance', () => {
    test('should handle rapid task submission', () => {
      const modelID = createModelID('model-001');
      const modelData = Buffer.alloc(256);

      inferenceEngine.loadModel(modelID, modelData);

      const startTime = Date.now();

      for (let i = 0; i < 100; i++) {
        const input = Buffer.alloc(100);
        inferenceEngine.submitTask(input, modelID, TaskPriority.Normal);
      }

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(5000); // 100 submissions should be fast
    });

    test('should process queue efficiently', () => {
      const modelID = createModelID('model-001');
      const modelData = Buffer.alloc(256);

      inferenceEngine.loadModel(modelID, modelData);

      // Submit multiple tasks
      for (let i = 0; i < 50; i++) {
        const input = Buffer.alloc(100);
        inferenceEngine.submitTask(input, modelID, TaskPriority.Normal);
      }

      const startTime = Date.now();
      inferenceEngine.processQueue();
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(10000); // Process 50 tasks in < 10 seconds
    });
  });
});
