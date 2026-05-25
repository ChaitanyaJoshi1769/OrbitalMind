/**
 * Thermal Engine Integration Test
 * Verify optimization library integration with thermal management
 */

import ThermalManagerOptimized, { ThermalSensorReadings } from '../../packages/thermal-engine/src/thermal-manager-optimized';
import { SystemConfig, ThermalStatus } from '@orbitalmind/shared';

describe('Thermal Engine Optimization Integration', () => {
  let thermalManager: ThermalManagerOptimized;
  let config: SystemConfig;

  beforeEach(() => {
    config = {
      thermalCriticalThreshold: 85,
      thermalWarningThreshold: 70,
      thermalLowPowerThreshold: 55,
      systemName: 'test-satellite'
    };
    thermalManager = new ThermalManagerOptimized(config);
  });

  describe('Vectorized Thermal Calculations', () => {
    test('should update sensor readings and predict temperature', () => {
      const reading: ThermalSensorReadings = {
        junctionTemp: 45,
        caseTemp: 40,
        radiatorTemp: 30,
        heatsinkTemp: 38,
        powerDraw: 10,
        timestamp: new Date()
      };

      thermalManager.updateSensorReadings(reading);

      const state = thermalManager.getState();
      expect(state.junctionTemperature).toBe(45);
      expect(state.currentPower).toBe(10);
      expect(state.status).toBe(ThermalStatus.Normal);

      console.log('Sensor reading updated and processed');
    });

    test('should track thermal status changes', () => {
      // Update with normal temperature
      let reading: ThermalSensorReadings = {
        junctionTemp: 40,
        caseTemp: 35,
        radiatorTemp: 25,
        heatsinkTemp: 33,
        powerDraw: 5,
        timestamp: new Date()
      };

      thermalManager.updateSensorReadings(reading);
      expect(thermalManager.getState().status).toBe(ThermalStatus.Normal);

      // Update with elevated temperature
      reading = {
        ...reading,
        junctionTemp: 60,
        timestamp: new Date()
      };
      thermalManager.updateSensorReadings(reading);
      expect(thermalManager.getState().status).toBe(ThermalStatus.Elevated);

      // Update with warning temperature
      reading = {
        ...reading,
        junctionTemp: 75,
        timestamp: new Date()
      };
      thermalManager.updateSensorReadings(reading);
      expect(thermalManager.getState().status).toBe(ThermalStatus.Warning);

      // Update with critical temperature
      reading = {
        ...reading,
        junctionTemp: 88,
        timestamp: new Date()
      };
      thermalManager.updateSensorReadings(reading);
      expect(thermalManager.getState().status).toBe(ThermalStatus.Critical);

      console.log('Thermal status transitions validated');
    });

    test('should compute temperature predictions efficiently', () => {
      // Simulate 20 sensor readings with increasing temperature
      const startTime = Date.now();

      for (let i = 0; i < 20; i++) {
        const reading: ThermalSensorReadings = {
          junctionTemp: 40 + (i * 2),
          caseTemp: 35 + (i * 1.8),
          radiatorTemp: 25 + (i * 1),
          heatsinkTemp: 33 + (i * 1.7),
          powerDraw: 5 + (i * 0.5),
          timestamp: new Date(Date.now() + i * 1000)
        };

        thermalManager.updateSensorReadings(reading);
      }

      const elapsed = Date.now() - startTime;

      const state = thermalManager.getState();
      expect(state.predictedTemperature30min).toBeGreaterThan(0);
      expect(elapsed).toBeLessThan(500); // Should be fast

      console.log(`20 readings processed in ${elapsed}ms, predicted temp: ${state.predictedTemperature30min.toFixed(1)}°C`);
    });

    test('should calculate DVFS adjustments based on temperature', () => {
      // Normal temperature
      let reading: ThermalSensorReadings = {
        junctionTemp: 45,
        caseTemp: 40,
        radiatorTemp: 30,
        heatsinkTemp: 38,
        powerDraw: 10,
        timestamp: new Date()
      };

      thermalManager.updateSensorReadings(reading);
      let dvfs = thermalManager.requestDVFSAdjustment();
      expect(dvfs.frequency).toBeGreaterThan(0);
      expect(dvfs.voltage).toBeGreaterThan(0);

      // High temperature - should reduce frequency
      reading = {
        ...reading,
        junctionTemp: 72,
        timestamp: new Date()
      };
      thermalManager.updateSensorReadings(reading);
      dvfs = thermalManager.requestDVFSAdjustment();
      expect(dvfs.frequency).toBeLessThan(1500); // Below nominal

      console.log(`DVFS adjustment: frequency=${dvfs.frequency}MHz, voltage=${dvfs.voltage.toFixed(2)}V`);
    });

    test('should calculate available power budget', () => {
      const reading: ThermalSensorReadings = {
        junctionTemp: 50,
        caseTemp: 45,
        radiatorTemp: 35,
        heatsinkTemp: 43,
        powerDraw: 10,
        timestamp: new Date()
      };

      thermalManager.updateSensorReadings(reading);

      const availablePower = thermalManager.getAvailablePowerBudget();
      expect(availablePower).toBeGreaterThan(0);

      console.log(`Available power budget: ${availablePower.toFixed(2)}W`);
    });

    test('should estimate cooling time to target temperature', () => {
      const reading: ThermalSensorReadings = {
        junctionTemp: 70,
        caseTemp: 65,
        radiatorTemp: 50,
        heatsinkTemp: 63,
        powerDraw: 15,
        timestamp: new Date()
      };

      thermalManager.updateSensorReadings(reading);

      const coolingTime = thermalManager.estimateCoolingTime(40);
      expect(coolingTime).toBeGreaterThan(0);
      expect(coolingTime).toBeLessThan(Infinity);

      console.log(`Cooling time to 40°C: ${coolingTime.toFixed(0)}s`);
    });
  });

  describe('Batch Thermal Processing', () => {
    test('should handle high-frequency sensor updates efficiently', () => {
      const startTime = Date.now();

      // Simulate 100Hz sensor update rate for 1 second (100 readings)
      for (let i = 0; i < 100; i++) {
        const reading: ThermalSensorReadings = {
          junctionTemp: 45 + Math.sin(i / 10) * 5,
          caseTemp: 40 + Math.sin(i / 10) * 4,
          radiatorTemp: 30 + Math.sin(i / 10) * 3,
          heatsinkTemp: 38 + Math.sin(i / 10) * 4,
          powerDraw: 10 + (Math.random() - 0.5) * 2,
          timestamp: new Date(Date.now() + i * 10) // 10ms intervals
        };

        thermalManager.updateSensorReadings(reading);
      }

      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(1000); // Should complete in < 1 second

      const metrics = thermalManager.getMetrics();
      expect(metrics.sensorUpdates).toBe(100);

      console.log(`100 sensor updates processed in ${elapsed}ms (${(100/elapsed*1000).toFixed(0)} updates/sec)`);
    });

    test('should maintain thermal history and compute trends', () => {
      // Build up sensor history
      for (let i = 0; i < 50; i++) {
        const reading: ThermalSensorReadings = {
          junctionTemp: 40 + (i * 0.5),
          caseTemp: 35 + (i * 0.4),
          radiatorTemp: 25 + (i * 0.3),
          heatsinkTemp: 33 + (i * 0.4),
          powerDraw: 8 + (i * 0.1),
          timestamp: new Date(Date.now() + i * 1000)
        };

        thermalManager.updateSensorReadings(reading);
      }

      const state = thermalManager.getState();
      expect(state.junctionTemperature).toBeGreaterThan(40);
      expect(state.predictedTemperature30min).toBeGreaterThan(state.junctionTemperature);

      console.log(
        `History: current=${state.junctionTemperature.toFixed(1)}°C, ` +
        `predicted=${state.predictedTemperature30min.toFixed(1)}°C`
      );
    });

    test('should scale efficiently with large thermal history', () => {
      // Add 3600 readings (1 hour at 1Hz)
      const startTime = Date.now();

      for (let i = 0; i < 3600; i++) {
        const reading: ThermalSensorReadings = {
          junctionTemp: 40 + Math.sin(i / 360) * 20,
          caseTemp: 35 + Math.sin(i / 360) * 18,
          radiatorTemp: 25 + Math.sin(i / 360) * 15,
          heatsinkTemp: 33 + Math.sin(i / 360) * 17,
          powerDraw: 8 + Math.cos(i / 180) * 4,
          timestamp: new Date(Date.now() + i * 1000)
        };

        thermalManager.updateSensorReadings(reading);
      }

      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(5000); // Should complete in < 5 seconds

      const metrics = thermalManager.getMetrics();
      console.log(
        `3600 readings in ${elapsed}ms, ` +
        `avg calc time: ${metrics.avgCalculationTime.toFixed(2)}ms`
      );
    });
  });

  describe('Thermal Transient Handling', () => {
    test('should handle rapid temperature spikes', () => {
      // Normal operation
      let reading: ThermalSensorReadings = {
        junctionTemp: 45,
        caseTemp: 40,
        radiatorTemp: 30,
        heatsinkTemp: 38,
        powerDraw: 10,
        timestamp: new Date()
      };

      thermalManager.updateSensorReadings(reading);

      // Rapid spike
      reading = {
        ...reading,
        junctionTemp: 75,
        caseTemp: 70,
        powerDraw: 25,
        timestamp: new Date()
      };

      thermalManager.updateSensorReadings(reading);
      let state = thermalManager.getState();
      expect(state.status).toBe(ThermalStatus.Warning);

      // Recovery
      for (let i = 0; i < 10; i++) {
        reading = {
          ...reading,
          junctionTemp: Math.max(45, 75 - i * 3),
          powerDraw: Math.max(10, 25 - i * 1.5),
          timestamp: new Date()
        };

        thermalManager.updateSensorReadings(reading);
      }

      state = thermalManager.getState();
      expect(state.junctionTemperature).toBeLessThan(50);

      console.log('Thermal transient handled successfully');
    });
  });

  describe('Performance Metrics', () => {
    test('should track thermal computation metrics', () => {
      // Generate thermal load
      for (let i = 0; i < 50; i++) {
        const reading: ThermalSensorReadings = {
          junctionTemp: 40 + Math.random() * 30,
          caseTemp: 35 + Math.random() * 28,
          radiatorTemp: 25 + Math.random() * 25,
          heatsinkTemp: 33 + Math.random() * 27,
          powerDraw: 8 + Math.random() * 15,
          timestamp: new Date()
        };

        thermalManager.updateSensorReadings(reading);
      }

      const metrics = thermalManager.getMetrics();

      expect(metrics.sensorUpdates).toBeGreaterThan(0);
      expect(metrics.thermalCalculations).toBeGreaterThan(0);
      expect(metrics.avgCalculationTime).toBeGreaterThanOrEqual(0);

      console.log(`
        Sensor updates: ${metrics.sensorUpdates}
        Thermal calculations: ${metrics.thermalCalculations}
        Avg calculation time: ${metrics.avgCalculationTime.toFixed(2)}ms
      `);
    });
  });

  describe('Thermal Diagnostics', () => {
    test('should provide comprehensive thermal diagnostics', () => {
      const reading: ThermalSensorReadings = {
        junctionTemp: 60,
        caseTemp: 55,
        radiatorTemp: 45,
        heatsinkTemp: 53,
        powerDraw: 12,
        timestamp: new Date()
      };

      thermalManager.updateSensorReadings(reading);

      const diagnostics = thermalManager.getDiagnostics();

      expect(diagnostics.currentTemp).toBeDefined();
      expect(diagnostics.predictedTemp30min).toBeDefined();
      expect(diagnostics.thermalMargin).toBeDefined();
      expect(diagnostics.status).toBeDefined();
      expect(diagnostics.availablePower).toBeDefined();
      expect(diagnostics.coolingTimeToNormal).toBeDefined();

      console.log('Thermal diagnostics:', JSON.stringify(diagnostics, null, 2));
    });

    test('should indicate when thermal throttling is needed', () => {
      // High power scenario that will need throttling
      for (let i = 0; i < 30; i++) {
        const reading: ThermalSensorReadings = {
          junctionTemp: 50 + (i * 1.2),
          caseTemp: 45 + (i * 1.1),
          radiatorTemp: 35 + (i * 0.9),
          heatsinkTemp: 43 + (i * 1),
          powerDraw: 18 + (i * 0.2),
          timestamp: new Date()
        };

        thermalManager.updateSensorReadings(reading);
      }

      const state = thermalManager.getState();
      const dvfs = thermalManager.requestDVFSAdjustment();

      if (state.status === ThermalStatus.Warning || state.status === ThermalStatus.Critical) {
        expect(dvfs.frequency).toBeLessThan(1500);
        console.log(`Throttling activated: frequency=${dvfs.frequency}MHz`);
      }
    });
  });
});
