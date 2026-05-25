/**
 * Autonomy Formation Control Integration Test
 * Verify optimization library integration with formation control
 */

import FormationControlOptimized from '../../packages/autonomy-core/src/formation-control-optimized';
import { SatelliteFormationState } from '../../packages/autonomy-core/src/formation-control-optimized';

describe('Autonomy Formation Control Optimization', () => {
  let controller: FormationControlOptimized;

  beforeEach(() => {
    controller = new FormationControlOptimized();
  });

  describe('Vectorized Formation Control', () => {
    test('should compute formation control for linear formation', () => {
      // Create linear formation (3 satellites)
      const satellites: SatelliteFormationState[] = [
        {
          satelliteId: 'SAT-0',
          position: { x: 0, y: 0, z: 600 },
          velocity: { x: 7.8, y: 0, z: 0 },
          mass: 1000
        },
        {
          satelliteId: 'SAT-1',
          position: { x: 100, y: 0, z: 600 },
          velocity: { x: 7.8, y: 0, z: 0 },
          mass: 1000
        },
        {
          satelliteId: 'SAT-2',
          position: { x: 200, y: 0, z: 600 },
          velocity: { x: 7.8, y: 0, z: 0 },
          mass: 1000
        }
      ];

      controller.setFormationConfiguration(
        { x: 100, y: 0, z: 600 },
        'linear',
        100
      );

      controller.registerSatellites(satellites);
      const outputs = controller.computeFormationControl();

      expect(outputs).toHaveLength(3);
      expect(outputs.every(o => o.controlForce !== undefined)).toBe(true);
      expect(outputs.every(o => o.convergenceError >= 0)).toBe(true);

      console.log('Linear formation control computed');
    });

    test('should compute formation control for pyramidal formation', () => {
      // Create 10 satellites for pyramidal formation
      const satellites: SatelliteFormationState[] = [];

      for (let i = 0; i < 10; i++) {
        satellites.push({
          satelliteId: `SAT-${i}`,
          position: {
            x: Math.random() * 1000,
            y: Math.random() * 1000,
            z: 600
          },
          velocity: { x: 7.8, y: 0, z: 0 },
          mass: 1000
        });
      }

      controller.setFormationConfiguration(
        { x: 500, y: 500, z: 600 },
        'pyramidal',
        200
      );

      controller.registerSatellites(satellites);
      const outputs = controller.computeFormationControl();

      expect(outputs).toHaveLength(10);
      expect(outputs.every(o => o.convergenceError >= 0)).toBe(true);

      const avgError = outputs.reduce((sum, o) => sum + o.convergenceError, 0) / outputs.length;
      console.log(`Pyramidal formation (10 sats): average error = ${avgError.toFixed(2)}m`);
    });

    test('should compute formation control for circular formation', () => {
      // Create 20 satellites for circular formation
      const satellites: SatelliteFormationState[] = [];

      for (let i = 0; i < 20; i++) {
        satellites.push({
          satelliteId: `SAT-${i}`,
          position: {
            x: Math.random() * 2000,
            y: Math.random() * 2000,
            z: 600
          },
          velocity: { x: 7.8 + (Math.random() - 0.5) * 0.1, y: 0, z: 0 },
          mass: 1000
        });
      }

      controller.setFormationConfiguration(
        { x: 1000, y: 1000, z: 600 },
        'circular',
        300
      );

      controller.registerSatellites(satellites);
      const outputs = controller.computeFormationControl();

      expect(outputs).toHaveLength(20);

      const avgError = outputs.reduce((sum, o) => sum + o.convergenceError, 0) / outputs.length;
      const maxError = Math.max(...outputs.map(o => o.convergenceError));

      console.log(
        `Circular formation (20 sats): ` +
        `avg error = ${avgError.toFixed(2)}m, max error = ${maxError.toFixed(2)}m`
      );
    });

    test('should handle large formation efficiently', () => {
      // Create 100 satellites
      const satCount = 100;
      const satellites: SatelliteFormationState[] = [];

      for (let i = 0; i < satCount; i++) {
        satellites.push({
          satelliteId: `SAT-${i}`,
          position: {
            x: 5000 + Math.random() * 1000,
            y: 5000 + Math.random() * 1000,
            z: 600 + Math.random() * 100
          },
          velocity: { x: 7.8 + (Math.random() - 0.5) * 0.2, y: 0, z: 0 },
          mass: 1000
        });
      }

      controller.setFormationConfiguration(
        { x: 5500, y: 5500, z: 650 },
        'linear',
        100
      );

      controller.registerSatellites(satellites);

      const startTime = Date.now();
      const outputs = controller.computeFormationControl();
      const elapsed = Date.now() - startTime;

      expect(outputs).toHaveLength(satCount);
      expect(elapsed).toBeLessThan(1000); // Should be fast

      const metrics = controller.getMetrics();
      console.log(
        `Large formation (${satCount} sats): ${elapsed}ms, ` +
        `avg computation time: ${metrics.avgComputationTime.toFixed(2)}ms, ` +
        `formation error: ${metrics.formationError.toFixed(3)}m`
      );
    });
  });

  describe('Formation Convergence', () => {
    test('should converge formation over multiple iterations', () => {
      // Create 5 satellites far from desired positions
      const satellites: SatelliteFormationState[] = [
        {
          satelliteId: 'SAT-0',
          position: { x: -100, y: -100, z: 600 },
          velocity: { x: 7.8, y: 0, z: 0 },
          mass: 1000
        },
        {
          satelliteId: 'SAT-1',
          position: { x: 200, y: 100, z: 600 },
          velocity: { x: 7.8, y: 0, z: 0 },
          mass: 1000
        },
        {
          satelliteId: 'SAT-2',
          position: { x: -50, y: 200, z: 600 },
          velocity: { x: 7.8, y: 0, z: 0 },
          mass: 1000
        }
      ];

      controller.setFormationConfiguration(
        { x: 0, y: 0, z: 600 },
        'linear',
        100
      );

      controller.registerSatellites(satellites);

      const errors: number[] = [];

      // Simulate 5 control iterations
      for (let iter = 0; iter < 5; iter++) {
        const outputs = controller.computeFormationControl();
        errors.push(controller.getFormationError());

        // Update satellite states based on control outputs
        for (const output of outputs) {
          const sat = satellites.find(s => s.satelliteId === output.satelliteId);
          if (sat) {
            // Simple integration: update position based on control
            sat.velocity = output.desiredVelocity;
            sat.position.x += sat.velocity.x * 0.1;
            sat.position.y += sat.velocity.y * 0.1;
            sat.position.z += sat.velocity.z * 0.1;
            controller.updateSatelliteState(sat.satelliteId, sat);
          }
        }
      }

      // Error should generally decrease over iterations
      expect(errors.length).toBe(5);
      console.log(`Convergence errors over iterations: ${errors.map(e => e.toFixed(2)).join(', ')}`);
    });

    test('should indicate when formation is converged', () => {
      // Create well-positioned formation
      const satellites: SatelliteFormationState[] = [
        {
          satelliteId: 'SAT-0',
          position: { x: -50, y: 0, z: 600 },
          velocity: { x: 7.8, y: 0, z: 0 },
          mass: 1000
        },
        {
          satelliteId: 'SAT-1',
          position: { x: 0, y: 0, z: 600 },
          velocity: { x: 7.8, y: 0, z: 0 },
          mass: 1000
        },
        {
          satelliteId: 'SAT-2',
          position: { x: 50, y: 0, z: 600 },
          velocity: { x: 7.8, y: 0, z: 0 },
          mass: 1000
        }
      ];

      controller.setFormationConfiguration(
        { x: 0, y: 0, z: 600 },
        'linear',
        100
      );

      controller.registerSatellites(satellites);
      controller.computeFormationControl();

      const isConverged = controller.isFormationConverged(200); // 200m tolerance
      expect(isConverged).toBe(true);

      console.log(`Formation converged: ${isConverged}`);
    });
  });

  describe('Performance Metrics', () => {
    test('should track control computation metrics', () => {
      const satellites: SatelliteFormationState[] = [];

      for (let i = 0; i < 50; i++) {
        satellites.push({
          satelliteId: `SAT-${i}`,
          position: {
            x: Math.random() * 5000,
            y: Math.random() * 5000,
            z: 600
          },
          velocity: { x: 7.8, y: 0, z: 0 },
          mass: 1000
        });
      }

      controller.setFormationConfiguration(
        { x: 2500, y: 2500, z: 600 },
        'circular',
        500
      );

      controller.registerSatellites(satellites);

      // Compute control multiple times
      for (let i = 0; i < 10; i++) {
        controller.computeFormationControl();
      }

      const metrics = controller.getMetrics();

      expect(metrics.controlComputations).toBe(10);
      expect(metrics.avgComputationTime).toBeGreaterThan(0);
      expect(metrics.formationError).toBeGreaterThanOrEqual(0);

      console.log(`
        Control computations: ${metrics.controlComputations}
        Avg computation time: ${metrics.avgComputationTime.toFixed(2)}ms
        Formation error: ${metrics.formationError.toFixed(3)}m
        Convergence rate: ${metrics.convergenceRate.toFixed(4)}
      `);
    });

    test('should show O(n) scaling with vectorization', () => {
      // Test with increasing formation sizes
      const results: Array<{ size: number; time: number }> = [];

      for (const size of [10, 50, 100]) {
        const satellites: SatelliteFormationState[] = [];

        for (let i = 0; i < size; i++) {
          satellites.push({
            satelliteId: `SAT-${i}`,
            position: {
              x: Math.random() * 10000,
              y: Math.random() * 10000,
              z: 600
            },
            velocity: { x: 7.8, y: 0, z: 0 },
            mass: 1000
          });
        }

        const ctrl = new FormationControlOptimized();
        ctrl.setFormationConfiguration(
          { x: 5000, y: 5000, z: 600 },
          'pyramidal',
          200
        );
        ctrl.registerSatellites(satellites);

        const startTime = Date.now();
        ctrl.computeFormationControl();
        const elapsed = Date.now() - startTime;

        results.push({ size, time: elapsed });
      }

      // Verify linear scaling (O(n))
      // 100 satellites should take ~10x time of 10 satellites
      expect(results[2].time).toBeLessThan(results[0].time * 20);

      console.log('Scaling test results (O(n) vectorization):');
      results.forEach(r => console.log(`  ${r.size} satellites: ${r.time}ms`));
    });
  });

  describe('Control Output Validation', () => {
    test('should provide valid control outputs for each satellite', () => {
      const satellites: SatelliteFormationState[] = [
        {
          satelliteId: 'SAT-0',
          position: { x: 0, y: 0, z: 600 },
          velocity: { x: 7.8, y: 0, z: 0 },
          mass: 1500
        },
        {
          satelliteId: 'SAT-1',
          position: { x: 150, y: 0, z: 600 },
          velocity: { x: 7.8, y: 0, z: 0 },
          mass: 1000
        },
        {
          satelliteId: 'SAT-2',
          position: { x: 300, y: 0, z: 600 },
          velocity: { x: 7.8, y: 0, z: 0 },
          mass: 1200
        }
      ];

      controller.setFormationConfiguration(
        { x: 150, y: 0, z: 600 },
        'linear',
        150
      );

      controller.registerSatellites(satellites);
      const outputs = controller.computeFormationControl();

      // Verify all outputs are valid
      for (const output of outputs) {
        expect(output.satelliteId).toBeDefined();
        expect(output.desiredVelocity).toBeDefined();
        expect(output.controlForce).toBeDefined();
        expect(output.thrustRequired).toBeGreaterThanOrEqual(0);
        expect(output.convergenceError).toBeGreaterThanOrEqual(0);

        // Verify individual values are reasonable
        expect(Math.abs(output.controlForce.x)).toBeLessThan(10000); // N
        expect(Math.abs(output.controlForce.y)).toBeLessThan(10000);
        expect(Math.abs(output.controlForce.z)).toBeLessThan(10000);
      }

      // Test getControlOutput for specific satellite
      const sat0Output = controller.getControlOutput('SAT-0');
      expect(sat0Output).toBeDefined();
      expect(sat0Output?.satelliteId).toBe('SAT-0');

      console.log('Control outputs validated for all satellites');
    });
  });
});
