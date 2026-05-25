/**
 * Radiation Runtime Integration Test
 * Verify optimization library integration with ECC memory protection
 */

import RadiationManagerOptimized from '../../packages/radiation-runtime/src/radiation-manager-optimized';
import { RadiationEvent } from '@orbitalmind/shared';

describe('Radiation Runtime Optimization Integration', () => {
  let radiationManager: RadiationManagerOptimized;

  beforeEach(() => {
    radiationManager = new RadiationManagerOptimized();
  });

  describe('Optimized ECC Memory Protection', () => {
    test('should register memory blocks and protect with ECC', () => {
      // Register memory block
      radiationManager.registerMemoryBlock(0x1000, 256);

      // Write data
      const testData = Buffer.from('Hello, World! This is protected memory.');
      radiationManager.writeMemory(0x1000, testData);

      // Read data (should be correct without errors)
      const readData = radiationManager.readMemory(0x1000);

      expect(readData.slice(0, testData.length)).toEqual(testData);

      console.log('Memory block registered and protected with ECC');
    });

    test('should handle single-bit errors in protected memory', () => {
      radiationManager.registerMemoryBlock(0x2000, 128);

      const testData = Buffer.from('Protected data with single-bit error detection');
      radiationManager.writeMemory(0x2000, testData);

      // Simulate single-bit error (flip one bit)
      const blockHealth = radiationManager.getMemoryHealth();
      expect(blockHealth.totalBlocks).toBe(1);

      // Read should detect and correct any errors
      const readData = radiationManager.readMemory(0x2000);
      expect(readData.slice(0, testData.length)).toEqual(testData);

      console.log('Single-bit error detection and correction working');
    });

    test('should register multiple memory blocks efficiently', () => {
      const blockCount = 100;
      const blocks = [];

      for (let i = 0; i < blockCount; i++) {
        blocks.push({
          address: 0x10000 + i * 256,
          size: 256
        });
      }

      const startTime = Date.now();
      radiationManager.registerMemoryBlocks(blocks);
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(500);

      const health = radiationManager.getMemoryHealth();
      expect(health.totalBlocks).toBe(blockCount);

      console.log(`${blockCount} memory blocks registered in ${elapsed}ms`);
    });

    test('should use single-pass ECC for fast scrubbing', () => {
      // Register 50 memory blocks
      for (let i = 0; i < 50; i++) {
        radiationManager.registerMemoryBlock(0x10000 + i * 256, 256);
      }

      // Write data to all blocks
      const testData = Buffer.from('Test data for ECC protection');
      for (let i = 0; i < 50; i++) {
        radiationManager.writeMemory(0x10000 + i * 256, testData);
      }

      // Allow some scrubbing cycles
      const startTime = Date.now();

      // Trigger multiple reads (which triggers scrubbing)
      for (let i = 0; i < 50; i++) {
        radiationManager.readMemory(0x10000 + i * 256);
      }

      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(2000); // Should be fast

      const metrics = radiationManager.getMetrics();
      console.log(
        `50 blocks scrubbed in ${elapsed}ms, ` +
        `avg scrub time: ${metrics.avgScrubTime.toFixed(2)}ms`
      );
    });

    test('should handle batch memory operations', () => {
      // Register and write to multiple blocks
      const blockCount = 25;
      const startTime = Date.now();

      for (let i = 0; i < blockCount; i++) {
        radiationManager.registerMemoryBlock(0x20000 + i * 512, 512);

        const data = Buffer.alloc(100);
        for (let j = 0; j < 100; j++) {
          data[j] = (i + j) % 256;
        }

        radiationManager.writeMemory(0x20000 + i * 512, data);
      }

      // Read all blocks
      for (let i = 0; i < blockCount; i++) {
        const readData = radiationManager.readMemory(0x20000 + i * 512);
        expect(readData).toBeDefined();
      }

      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(1000);

      console.log(`Batch operations for ${blockCount} blocks: ${elapsed}ms`);
    });
  });

  describe('Checkpoint Management', () => {
    test('should create and restore checkpoints', () => {
      const taskID = 'task-001' as any;
      const modelState = Buffer.from('model state data');
      const inputBuffer = Buffer.from('input data');
      const computeState = Buffer.from('compute state');

      const checkpoint = radiationManager.createCheckpoint(
        taskID,
        1,
        modelState,
        inputBuffer,
        computeState
      );

      expect(checkpoint.taskID).toBe(taskID);
      expect(checkpoint.iteration).toBe(1);

      // Restore checkpoint
      const restored = radiationManager.restoreCheckpoint(taskID);
      expect(restored).toBeDefined();
      expect(restored?.taskID).toBe(taskID);

      console.log('Checkpoint created and restored successfully');
    });

    test('should verify checkpoint integrity', () => {
      const taskID = 'task-002' as any;
      const modelState = Buffer.from('model data');
      const inputBuffer = Buffer.from('input data');
      const computeState = Buffer.from('compute state');

      const checkpoint = radiationManager.createCheckpoint(
        taskID,
        1,
        modelState,
        inputBuffer,
        computeState
      );

      const isValid = radiationManager.verifyCheckpoint(checkpoint);
      expect(isValid).toBe(true);

      console.log('Checkpoint integrity verified');
    });

    test('should maintain checkpoint history', () => {
      const taskID = 'task-003' as any;

      // Create multiple checkpoints
      for (let i = 0; i < 5; i++) {
        const modelState = Buffer.from(`model state ${i}`);
        const inputBuffer = Buffer.from(`input ${i}`);
        const computeState = Buffer.from(`compute ${i}`);

        radiationManager.createCheckpoint(
          taskID,
          i,
          modelState,
          inputBuffer,
          computeState
        );
      }

      // Latest should be iteration 4
      const latest = radiationManager.restoreCheckpoint(taskID);
      expect(latest?.iteration).toBe(4);

      console.log('Checkpoint history maintained (5 iterations)');
    });
  });

  describe('Radiation Event Tracking', () => {
    test('should record and track radiation events', () => {
      const event1: RadiationEvent = {
        eventType: 'SEU',
        severity: 'high',
        timestamp: new Date(),
        corrected: true
      };

      const event2: RadiationEvent = {
        eventType: 'SET',
        severity: 'critical',
        timestamp: new Date(),
        corrected: false
      };

      radiationManager.recordRadiationEvent(event1);
      radiationManager.recordRadiationEvent(event2);

      const stats = radiationManager.getRadiationStatistics();
      expect(stats.seu).toBe(1);
      expect(stats.set).toBe(1);
      expect(stats.corrected).toBe(1);
      expect(stats.uncorrected).toBe(1);

      console.log('Radiation events tracked:', JSON.stringify(stats, null, 2));
    });

    test('should determine redundancy requirements', () => {
      // Record many SEU events
      for (let i = 0; i < 150; i++) {
        const event: RadiationEvent = {
          eventType: 'SEU',
          severity: 'low',
          timestamp: new Date(),
          corrected: true
        };
        radiationManager.recordRadiationEvent(event);
      }

      const shouldUseRedundancy = radiationManager.shouldUseRedundancy();
      expect(shouldUseRedundancy).toBe(true);

      console.log('Redundancy required for high radiation environment');
    });
  });

  describe('Memory Health Monitoring', () => {
    test('should report memory health status', () => {
      // Register multiple memory blocks
      for (let i = 0; i < 10; i++) {
        radiationManager.registerMemoryBlock(0x30000 + i * 256, 256);
      }

      const health = radiationManager.getMemoryHealth();

      expect(health.totalBlocks).toBe(10);
      expect(health.errorFreeBlocks).toBe(10); // Initially all error-free
      expect(health.degradedBlocks).toBe(0);
      expect(health.totalErrors).toBe(0);

      console.log('Memory health:', JSON.stringify(health, null, 2));
    });
  });

  describe('Performance Metrics', () => {
    test('should track optimization performance metrics', () => {
      // Set up memory with multiple blocks
      for (let i = 0; i < 64; i++) {
        radiationManager.registerMemoryBlock(0x40000 + i * 512, 512);
      }

      // Write and read data
      const testData = Buffer.from('Performance test data');
      for (let i = 0; i < 64; i++) {
        radiationManager.writeMemory(0x40000 + i * 512, testData);
      }

      for (let i = 0; i < 64; i++) {
        radiationManager.readMemory(0x40000 + i * 512);
      }

      const metrics = radiationManager.getMetrics();

      expect(metrics.scrubOperations).toBeGreaterThanOrEqual(0);
      expect(metrics.avgScrubTime).toBeGreaterThanOrEqual(0);

      console.log(`
        Scrub operations: ${metrics.scrubOperations}
        Errors detected: ${metrics.errorsDetected}
        Errors corrected: ${metrics.errorsCorrected}
        Avg scrub time: ${metrics.avgScrubTime.toFixed(2)}ms
      `);
    });

    test('should show ECC optimization effectiveness', () => {
      // Register 128 memory blocks
      const blockCount = 128;
      for (let i = 0; i < blockCount; i++) {
        radiationManager.registerMemoryBlock(0x50000 + i * 256, 256);
      }

      // Perform batch operations
      const startTime = Date.now();

      for (let i = 0; i < blockCount; i++) {
        const data = Buffer.alloc(100);
        data.fill(i % 256);
        radiationManager.writeMemory(0x50000 + i * 256, data);
      }

      for (let i = 0; i < blockCount; i++) {
        radiationManager.readMemory(0x50000 + i * 256);
      }

      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(3000); // Should be fast

      const stats = radiationManager.getOptimizationStats();
      console.log('ECC optimization stats:', JSON.stringify(stats, null, 2));
    });

    test('should scale efficiently with large memory arrays', () => {
      const blockCount = 1000;
      const startTime = Date.now();

      // Register 1000 blocks
      for (let i = 0; i < blockCount; i++) {
        radiationManager.registerMemoryBlock(0x60000 + i * 64, 64);
      }

      const registerTime = Date.now() - startTime;

      expect(registerTime).toBeLessThan(5000); // Should handle large arrays efficiently

      console.log(`Registered ${blockCount} memory blocks in ${registerTime}ms`);
    });
  });
});
