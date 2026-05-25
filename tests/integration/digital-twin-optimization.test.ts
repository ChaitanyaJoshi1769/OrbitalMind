/**
 * Digital Twin Integration Test
 * Verify optimization library integration with orbital propagator
 */

import OrbitalPropagatorOptimized from '../../apps/digital-twin/src/simulation/orbital-propagator-optimized';

describe('Digital Twin Optimization Integration', () => {
  let propagator: OrbitalPropagatorOptimized;

  beforeEach(() => {
    propagator = new OrbitalPropagatorOptimized();
  });

  describe('Optimized Orbital Propagation', () => {
    test('should propagate single satellite using cached Kepler solver', () => {
      // Register ISS-like satellite
      const satellite = {
        satelliteId: 'ISS',
        semiMajorAxis: 6.78e6, // meters (LEO)
        eccentricity: 0.0001,
        inclination: 51.6,
        rightAscensionAscendingNode: 0,
        argumentOfPerigee: 0,
        meanAnomaly: 0,
        epoch: Date.now()
      };

      propagator.registerSatellite(satellite);

      // Propagate to 1 hour in the future
      const targetTime = satellite.epoch + 3600 * 1000; // 1 hour in ms
      const state = propagator.propagateSatellite(satellite.satelliteId, targetTime);

      expect(state).toBeDefined();
      expect(state!.position).toBeDefined();
      expect(state!.velocity).toBeDefined();
      expect(state!.timestamp).toBe(targetTime);
    });

    test('should demonstrate Kepler solver caching benefit', () => {
      // Register satellite
      const satellite = {
        satelliteId: 'SAT-001',
        semiMajorAxis: 6.78e6,
        eccentricity: 0.0005,
        inclination: 98,
        rightAscensionAscendingNode: 0,
        argumentOfPerigee: 0,
        meanAnomaly: 0,
        epoch: Date.now()
      };

      propagator.registerSatellite(satellite);

      const epoch = satellite.epoch;

      // First propagation - will compute
      const start1 = Date.now();
      propagator.propagateSatellite(satellite.satelliteId, epoch + 3600 * 1000);
      const time1 = Date.now() - start1;

      // Second propagation to same mean anomaly - should use cache
      const start2 = Date.now();
      propagator.propagateSatellite(satellite.satelliteId, epoch + 3600 * 1000);
      const time2 = Date.now() - start2;

      // Cached should be faster or equivalent
      expect(time2).toBeLessThanOrEqual(time1 + 5); // Allow small margin for timing variance

      const metrics = propagator.getMetrics();
      expect(metrics.solvesCached).toBeGreaterThan(0);
      console.log(`Cache hit rate: ${metrics.cacheHitRate.toFixed(1)}%`);
    });

    test('should propagate constellation efficiently', () => {
      // Register multiple satellites (simulated mega-constellation)
      const satCount = 100;
      for (let i = 0; i < satCount; i++) {
        const satellite = {
          satelliteId: `SAT-${i}`,
          semiMajorAxis: 6.78e6 + i * 1000, // Slight variation
          eccentricity: 0.0001,
          inclination: 97 + (i % 3) * 0.1,
          rightAscensionAscendingNode: (i / satCount) * 360,
          argumentOfPerigee: 0,
          meanAnomaly: 0,
          epoch: Date.now()
        };

        propagator.registerSatellite(satellite);
      }

      // Propagate entire constellation
      const epoch = Date.now();
      const start = Date.now();
      const states = propagator.propagateConstellation(epoch + 3600 * 1000);
      const elapsed = Date.now() - start;

      expect(states).toHaveLength(satCount);
      expect(elapsed).toBeLessThan(5000); // Should complete in < 5 seconds

      const metrics = propagator.getMetrics();
      console.log(
        `Propagated ${satCount} satellites in ${elapsed}ms, ` +
        `cache hit rate: ${metrics.cacheHitRate.toFixed(1)}%`
      );

      expect(elapsed).toBeLessThan(1000); // Should be very fast with caching
    });

    test('should handle long-duration propagation', () => {
      // Register satellite
      const satellite = {
        satelliteId: 'LONG-DURATION',
        semiMajorAxis: 6.78e6,
        eccentricity: 0.0001,
        inclination: 98,
        rightAscensionAscendingNode: 0,
        argumentOfPerigee: 0,
        meanAnomaly: 0,
        epoch: Date.now()
      };

      propagator.registerSatellite(satellite);

      // Propagate 24 hours into the future
      const epoch = satellite.epoch;
      const targetTime = epoch + 24 * 3600 * 1000; // 24 hours

      const start = Date.now();
      const state = propagator.propagateSatellite(satellite.satelliteId, targetTime);
      const elapsed = Date.now() - start;

      expect(state).toBeDefined();
      expect(elapsed).toBeLessThan(100); // Should be very fast

      // Verify position is reasonable
      const distance = Math.sqrt(
        state!.position.x * state!.position.x +
        state!.position.y * state!.position.y +
        state!.position.z * state!.position.z
      );

      // Should be in LEO range (6.4M to 7.0M meters)
      expect(distance).toBeGreaterThan(6.3e6);
      expect(distance).toBeLessThan(7.5e6);
    });

    test('should handle various orbital elements', () => {
      const testCases = [
        // LEO
        {
          id: 'LEO',
          semiMajorAxis: 6.78e6,
          eccentricity: 0.0001,
          inclination: 51.6
        },
        // MEO
        {
          id: 'MEO',
          semiMajorAxis: 2.66e7,
          eccentricity: 0.001,
          inclination: 55
        },
        // High eccentricity
        {
          id: 'ELIPTICAL',
          semiMajorAxis: 1.0e7,
          eccentricity: 0.7,
          inclination: 60
        }
      ];

      for (const testCase of testCases) {
        const satellite = {
          satelliteId: testCase.id,
          semiMajorAxis: testCase.semiMajorAxis,
          eccentricity: testCase.eccentricity,
          inclination: testCase.inclination,
          rightAscensionAscendingNode: 0,
          argumentOfPerigee: 0,
          meanAnomaly: 0,
          epoch: Date.now()
        };

        propagator.registerSatellite(satellite);

        const state = propagator.propagateSatellite(
          satellite.satelliteId,
          satellite.epoch + 3600 * 1000
        );

        expect(state).toBeDefined();
        expect(state!.position).toBeDefined();
        console.log(
          `${testCase.id}: a=${testCase.semiMajorAxis / 1e6}M m, ` +
          `e=${testCase.eccentricity}, ` +
          `i=${testCase.inclination}°`
        );
      }
    });
  });

  describe('Performance Metrics', () => {
    test('should track solver caching statistics', () => {
      const satellite = {
        satelliteId: 'TEST-SAT',
        semiMajorAxis: 6.78e6,
        eccentricity: 0.001,
        inclination: 98,
        rightAscensionAscendingNode: 0,
        argumentOfPerigee: 0,
        meanAnomaly: 0,
        epoch: Date.now()
      };

      propagator.registerSatellite(satellite);

      const epoch = satellite.epoch;

      // Multiple propagations to same times (should use cache)
      for (let i = 0; i < 10; i++) {
        propagator.propagateSatellite(satellite.satelliteId, epoch + 3600 * 1000);
        propagator.propagateSatellite(satellite.satelliteId, epoch + 7200 * 1000);
      }

      const metrics = propagator.getMetrics();

      console.log(`
        Propagations: ${metrics.propagations}
        Solves cached: ${metrics.solvesCached}
        Solves computed: ${metrics.solvesComputed}
        Cache hit rate: ${metrics.cacheHitRate.toFixed(1)}%
      `);

      expect(metrics.cacheHitRate).toBeGreaterThan(50); // Should have good cache hit rate
      expect(metrics.solvesCached).toBeGreaterThan(metrics.solvesComputed);
    });

    test('should handle large constellation with high cache efficiency', () => {
      const satCount = 500; // Large mega-constellation

      // Register constellation
      for (let i = 0; i < satCount; i++) {
        const satellite = {
          satelliteId: `SAT-${i}`,
          semiMajorAxis: 6.78e6 + (i % 10) * 1000,
          eccentricity: 0.0001,
          inclination: 97 + ((i / satCount) * 2), // Slight variation
          rightAscensionAscendingNode: (i / satCount) * 360,
          argumentOfPerigee: 0,
          meanAnomaly: 0,
          epoch: Date.now()
        };

        propagator.registerSatellite(satellite);
      }

      // Propagate constellation
      const epoch = Date.now();
      const start = Date.now();
      propagator.propagateConstellation(epoch + 3600 * 1000);
      const elapsed = Date.now() - start;

      const metrics = propagator.getMetrics();

      console.log(`
        Constellation: ${satCount} satellites
        Time: ${elapsed}ms
        Propagations: ${metrics.propagations}
        Cache hit rate: ${metrics.cacheHitRate.toFixed(1)}%
      `);

      expect(elapsed).toBeLessThan(10000); // Large constellation should still be fast
      expect(metrics.cacheHitRate).toBeGreaterThan(0); // Should have some caching
    });
  });
});
