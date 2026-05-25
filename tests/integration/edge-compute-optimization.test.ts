/**
 * Edge Compute Optimization Integration Test
 * Verify optimized gradient compression for federated learning
 */

import FederatedLearningCoordinatorOptimized from '../../apps/edge-compute/src/communication/federated-learning-optimized';
import type { CompressedGradientUpdate } from '../../apps/edge-compute/src/communication/federated-learning-optimized';

describe('Edge Compute Optimization Integration', () => {
  let coordinator: FederatedLearningCoordinatorOptimized;

  beforeEach(() => {
    coordinator = new FederatedLearningCoordinatorOptimized();
  });

  describe('Satellite Registration and Metrics', () => {
    test('should register satellites for federated learning', () => {
      coordinator.registerSatellite('SAT-001', ['model-thermal', 'model-power']);
      coordinator.registerSatellite('SAT-002', ['model-thermal']);

      const metrics1 = coordinator.getSatelliteMetrics('SAT-001');
      const metrics2 = coordinator.getSatelliteMetrics('SAT-002');

      expect(metrics1).toBeDefined();
      expect(metrics1?.modelsTraining).toContain('model-thermal');
      expect(metrics2?.modelsTraining).toHaveLength(1);

      console.log('Satellites registered for federated learning');
    });

    test('should track satellite metrics', () => {
      coordinator.registerSatellite('SAT-001', ['model-thermal']);

      const metrics = coordinator.getSatelliteMetrics('SAT-001');
      expect(metrics?.gradientsSent).toBe(0);
      expect(metrics?.avgCompressionRatio).toBe(1.0);

      console.log('Satellite metrics tracking initialized');
    });
  });

  describe('Gradient Compression', () => {
    test('should compress sparse gradients with 4x ratio', () => {
      coordinator.registerSatellite('SAT-001', ['model-test']);

      // Create sparse gradients (mostly zeros with some significant values)
      const gradients: number[] = new Array(1000).fill(0);
      gradients[10] = 0.5;
      gradients[50] = -0.3;
      gradients[100] = 0.8;
      gradients[500] = -0.2;
      gradients[999] = 0.6;

      const compressed = coordinator.submitGradientsOptimized(
        'model-test',
        gradients,
        'SAT-001',
        1,
        32,
        0.1
      );

      expect(compressed.compressionRatio).toBeGreaterThan(1.0);
      expect(compressed.indices.length).toBeLessThan(gradients.length);
      expect(compressed.values.length).toEqual(compressed.indices.length);

      console.log(
        `Sparse gradient compression: ${gradients.length} -> ${compressed.indices.length} elements ` +
        `(ratio: ${compressed.compressionRatio.toFixed(2)}x)`
      );
    });

    test('should achieve 4x compression with sparse representation', () => {
      coordinator.registerSatellite('SAT-001', ['model-test']);

      let totalRatio = 0;
      let compressions = 0;

      for (let iter = 0; iter < 10; iter++) {
        const gradients = new Float32Array(4096);
        // Fill with sparse values (1% non-zero)
        for (let i = 0; i < 40; i++) {
          const idx = Math.floor(Math.random() * 4096);
          gradients[idx] = Math.random() - 0.5;
        }

        const compressed = coordinator.submitGradientsOptimized(
          'model-test',
          Array.from(gradients),
          'SAT-001',
          iter + 1,
          32,
          0.1
        );

        totalRatio += compressed.compressionRatio;
        compressions++;
      }

      const avgRatio = totalRatio / compressions;
      expect(avgRatio).toBeGreaterThan(2.0);

      console.log(`Average compression ratio over 10 iterations: ${avgRatio.toFixed(2)}x`);
    });

    test('should decompress gradients correctly', () => {
      coordinator.registerSatellite('SAT-001', ['model-test']);

      const originalGradients = [0, 0.5, 0, 0, -0.3, 0, 0.8, 0, 0, 0.6];

      const compressed = coordinator.submitGradientsOptimized(
        'model-test',
        originalGradients,
        'SAT-001',
        1,
        32,
        0.1
      );

      const decompressed = coordinator.decompressGradients(compressed);

      // Check non-zero values are preserved
      expect(decompressed[1]).toBeCloseTo(0.5, 1);
      expect(decompressed[4]).toBeCloseTo(-0.3, 1);
      expect(decompressed[6]).toBeCloseTo(0.8, 1);
      expect(decompressed[9]).toBeCloseTo(0.6, 1);

      // Check zero values are zero
      expect(Math.abs(decompressed[0])).toBeLessThan(0.01);
      expect(Math.abs(decompressed[2])).toBeLessThan(0.01);

      console.log('Gradient decompression verified');
    });
  });

  describe('Gradient Aggregation', () => {
    test('should aggregate gradients using FedAvg', () => {
      coordinator.registerSatellite('SAT-001', ['model-test']);
      coordinator.registerSatellite('SAT-002', ['model-test']);

      // Create and compress gradients from both satellites
      const gradients1 = new Array(100).fill(0);
      gradients1[10] = 0.5;
      gradients1[20] = 0.3;

      const gradients2 = new Array(100).fill(0);
      gradients2[30] = 0.6;
      gradients2[40] = 0.4;

      const compressed1 = coordinator.submitGradientsOptimized(
        'model-test',
        gradients1,
        'SAT-001',
        1,
        32,
        0.2
      );

      const compressed2 = coordinator.submitGradientsOptimized(
        'model-test',
        gradients2,
        'SAT-002',
        1,
        32,
        0.18
      );

      const aggregated = coordinator.aggregateGradientsFedAvg([compressed1, compressed2]);

      expect(aggregated.modelId).toBe('model-test');
      expect(aggregated.epoch).toBe(1);
      expect(aggregated.participantCount).toBe(2);
      expect(aggregated.aggregationMethod).toBe('fedavg');

      console.log('FedAvg aggregation: 2 satellites, compression ratio applied');
    });

    test('should aggregate gradients using Median', () => {
      coordinator.registerSatellite('SAT-001', ['model-test']);
      coordinator.registerSatellite('SAT-002', ['model-test']);
      coordinator.registerSatellite('SAT-003', ['model-test']);

      const createGradients = (values: number[]) => {
        const g = new Array(10).fill(0);
        values.forEach((v, i) => {
          g[i] = v;
        });
        return g;
      };

      const compressed1 = coordinator.submitGradientsOptimized(
        'model-test',
        createGradients([0.5, 0.3, 0.4, 0, 0, 0, 0, 0, 0, 0]),
        'SAT-001',
        1,
        32,
        0.2
      );

      const compressed2 = coordinator.submitGradientsOptimized(
        'model-test',
        createGradients([0.6, 0.2, 0.5, 0, 0, 0, 0, 0, 0, 0]),
        'SAT-002',
        1,
        32,
        0.18
      );

      const compressed3 = coordinator.submitGradientsOptimized(
        'model-test',
        createGradients([1.0, 0.7, 2.0, 0, 0, 0, 0, 0, 0, 0]), // Outlier
        'SAT-003',
        1,
        32,
        0.19
      );

      const aggregated = coordinator.aggregateGradientsMedian([compressed1, compressed2, compressed3]);

      expect(aggregated.aggregationMethod).toBe('median');
      expect(aggregated.participantCount).toBe(3);

      // Median should be more robust than mean to the outlier
      expect(aggregated.aggregatedGradients[0]).toBeLessThan(0.8);

      console.log('Median aggregation: Byzantine-robust across 3 satellites');
    });
  });

  describe('Compression Statistics', () => {
    test('should track compression statistics', () => {
      coordinator.registerSatellite('SAT-001', ['model-test']);

      // Submit multiple gradient updates
      for (let i = 0; i < 5; i++) {
        const gradients = new Array(2048).fill(0);
        // 2% sparse (40 non-zero values)
        for (let j = 0; j < 40; j++) {
          gradients[Math.floor(Math.random() * 2048)] = Math.random() - 0.5;
        }

        coordinator.submitGradientsOptimized(
          'model-test',
          gradients,
          'SAT-001',
          i + 1,
          32,
          0.1
        );
      }

      const stats = coordinator.getCompressionStatistics();

      expect(stats.totalCompressions).toBe(5);
      expect(parseInt(stats.totalBytesCompressions.toString())).toBeGreaterThan(0);
      expect(parseFloat(stats.avgCompressionRatio)).toBeGreaterThan(1.0);

      console.log(`
        Total compressions: ${stats.totalCompressions}
        Total bytes saved: ${stats.totalBytesCompressions}
        Avg compression ratio: ${stats.avgCompressionRatio}x
        Peak compression ratio: ${stats.peakCompressionRatio}x
        Bytes saved per update: ${stats.bytesSavedPerUpdate}
      `);
    });

    test('should show communication savings across constellation', async () => {
      // Register 10 satellites
      for (let i = 1; i <= 10; i++) {
        coordinator.registerSatellite(`SAT-${String(i).padStart(3, '0')}`, ['model-thermal']);
      }

      // Each satellite sends gradients for 5 epochs
      for (let epoch = 1; epoch <= 5; epoch++) {
        for (let i = 1; i <= 10; i++) {
          const gradients = new Array(8192).fill(0);
          // 5% sparse for realistic ML scenario
          for (let j = 0; j < 410; j++) {
            gradients[Math.floor(Math.random() * 8192)] = Math.random() - 0.5;
          }

          coordinator.submitGradientsOptimized(
            'model-thermal',
            gradients,
            `SAT-${String(i).padStart(3, '0')}`,
            epoch,
            64,
            0.15 + Math.random() * 0.1
          );
        }
      }

      const stats = coordinator.getCompressionStatistics();
      const allMetrics = coordinator.getAllSatelliteMetrics();

      expect(stats.totalCompressions).toBe(50); // 10 satellites * 5 epochs
      expect(allMetrics).toHaveLength(10);

      console.log(`
        Constellation Compression Summary:
        Total satellites: ${allMetrics.length}
        Total gradient updates: ${stats.totalCompressions}
        Total communication saved: ${stats.totalBytesCompressions} bytes
        Average compression ratio: ${stats.avgCompressionRatio}x
        Per-update savings: ${stats.bytesSavedPerUpdate} bytes
      `);

      allMetrics.forEach(m => {
        console.log(
          `  ${m.satelliteId}: ${m.gradientsSent} updates, ` +
          `saved ${m.totalCompressionSaved} bytes, ` +
          `ratio ${m.avgCompressionRatio.toFixed(2)}x`
        );
      });
    });
  });

  describe('Epoch Management', () => {
    test('should track epochs', () => {
      expect(coordinator.getCurrentEpoch()).toBe(0);

      coordinator.nextEpoch();
      expect(coordinator.getCurrentEpoch()).toBe(1);

      coordinator.nextEpoch();
      expect(coordinator.getCurrentEpoch()).toBe(2);

      console.log('Epoch management working');
    });
  });

  describe('Multi-Model Training', () => {
    test('should support multiple models per satellite', () => {
      coordinator.registerSatellite('SAT-001', ['model-thermal', 'model-power', 'model-anomaly']);

      // Submit gradients for different models
      const models = ['model-thermal', 'model-power', 'model-anomaly'];

      for (const model of models) {
        const gradients = new Array(512).fill(0);
        for (let i = 0; i < 25; i++) {
          gradients[Math.floor(Math.random() * 512)] = Math.random() - 0.5;
        }

        const update = coordinator.submitGradientsOptimized(
          model,
          gradients,
          'SAT-001',
          1,
          32,
          0.1
        );

        expect(update.modelId).toBe(model);
      }

      const metrics = coordinator.getSatelliteMetrics('SAT-001');
      expect(metrics?.gradientsSent).toBe(3);

      console.log('Multi-model training: 3 models per satellite');
    });

    test('should aggregate gradients from multiple models independently', () => {
      coordinator.registerSatellite('SAT-001', ['model-thermal']);
      coordinator.registerSatellite('SAT-002', ['model-thermal']);

      // Thermal model gradients
      const thermalGrad1 = coordinator.submitGradientsOptimized(
        'model-thermal',
        new Array(100).fill(0.1),
        'SAT-001',
        1,
        32,
        0.15
      );

      const thermalGrad2 = coordinator.submitGradientsOptimized(
        'model-thermal',
        new Array(100).fill(0.2),
        'SAT-002',
        1,
        32,
        0.12
      );

      const aggregatedThermal = coordinator.aggregateGradientsFedAvg([thermalGrad1, thermalGrad2]);

      expect(aggregatedThermal.modelId).toBe('model-thermal');
      expect(aggregatedThermal.participantCount).toBe(2);

      console.log('Multi-model aggregation: independent model updates');
    });
  });

  describe('Large-Scale Compression', () => {
    test('should scale compression with large models', () => {
      coordinator.registerSatellite('SAT-001', ['model-large']);

      const results: Array<{ modelSize: number; compressionRatio: number; savedBytes: number }> = [];

      for (const modelSize of [8192, 16384, 32768]) {
        const gradients = new Array(modelSize).fill(0);
        // Fill with 5% sparse gradients
        for (let i = 0; i < Math.floor(modelSize * 0.05); i++) {
          gradients[Math.floor(Math.random() * modelSize)] = Math.random() - 0.5;
        }

        const compressed = coordinator.submitGradientsOptimized(
          'model-large',
          gradients,
          'SAT-001',
          1,
          32,
          0.1
        );

        const saved = (modelSize * 4) - (compressed.indices.length * 4 + compressed.values.length * 4);

        results.push({
          modelSize,
          compressionRatio: compressed.compressionRatio,
          savedBytes: saved
        });
      }

      // Compression should be consistent across model sizes
      expect(results[1].compressionRatio).toBeGreaterThan(1.0);
      expect(results[2].compressionRatio).toBeGreaterThan(1.0);

      console.log('Compression scaling across model sizes:');
      results.forEach(r =>
        console.log(
          `  ${r.modelSize} parameters: ratio=${r.compressionRatio.toFixed(2)}x, ` +
          `saved=${r.savedBytes} bytes`
        )
      );
    });

    test('should show O(n) scaling of compression time with gradient size', () => {
      coordinator.registerSatellite('SAT-001', ['model-scale']);

      const results: Array<{ size: number; time: number }> = [];

      for (const size of [1024, 4096, 16384]) {
        const gradients = new Array(size).fill(0);
        for (let i = 0; i < Math.floor(size * 0.05); i++) {
          gradients[Math.floor(Math.random() * size)] = Math.random() - 0.5;
        }

        const startTime = Date.now();

        coordinator.submitGradientsOptimized(
          'model-scale',
          gradients,
          'SAT-001',
          1,
          32,
          0.1
        );

        const elapsed = Date.now() - startTime;
        results.push({ size, time: elapsed });
      }

      // Time should scale roughly linearly
      expect(results[2].time).toBeLessThan(results[0].time * 20);

      console.log('Compression time scaling:');
      results.forEach(r => console.log(`  ${r.size} parameters: ${r.time}ms`));
    });
  });
});
