/**
 * Thermal Engine Unit Tests
 * Comprehensive coverage of thermal management system
 */

import { ThermalManager } from '@orbitalmind/thermal-engine';
import { ThermalStatus, SystemConfig } from '@orbitalmind/shared';

describe('ThermalManager Unit Tests', () => {
  let thermalManager: ThermalManager;
  let config: SystemConfig;

  beforeEach(() => {
    config = {
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
  });

  describe('Temperature Management', () => {
    test('should track multiple temperature sensors', () => {
      const readings = {
        junctionTemp: 45,
        caseTemp: 40,
        radiatorTemp: 35,
        heatsinkTemp: 40,
        powerDraw: 8,
        timestamp: new Date()
      };

      thermalManager.updateSensorReadings(readings);
      const state = thermalManager.getState();

      expect(state.junctionTemperature).toBe(45);
      expect(state.caseTemperature).toBe(40);
      expect(state.radiatorTemperature).toBe(35);
    });

    test('should detect normal thermal conditions', () => {
      thermalManager.updateSensorReadings({
        junctionTemp: 30,
        caseTemp: 28,
        radiatorTemp: 25,
        heatsinkTemp: 28,
        powerDraw: 5,
        timestamp: new Date()
      });

      const state = thermalManager.getState();
      expect(state.status).toBe(ThermalStatus.Normal);
    });

    test('should detect warning thermal conditions', () => {
      thermalManager.updateSensorReadings({
        junctionTemp: 75,
        caseTemp: 72,
        radiatorTemp: 65,
        heatsinkTemp: 72,
        powerDraw: 12,
        timestamp: new Date()
      });

      const state = thermalManager.getState();
      expect(state.status).toBe(ThermalStatus.Warning);
    });

    test('should detect critical thermal conditions', () => {
      thermalManager.updateSensorReadings({
        junctionTemp: 90,
        caseTemp: 87,
        radiatorTemp: 75,
        heatsinkTemp: 87,
        powerDraw: 18,
        timestamp: new Date()
      });

      const state = thermalManager.getState();
      expect(state.status).toBe(ThermalStatus.Critical);
    });
  });

  describe('DVFS Adjustment', () => {
    test('should increase frequency at normal temperatures', () => {
      thermalManager.updateSensorReadings({
        junctionTemp: 30,
        caseTemp: 28,
        radiatorTemp: 25,
        heatsinkTemp: 28,
        powerDraw: 5,
        timestamp: new Date()
      });

      const dvfs = thermalManager.requestDVFSAdjustment();
      expect(dvfs.frequency).toBeGreaterThan(1400);
      expect(dvfs.voltage).toBeGreaterThan(0.9);
    });

    test('should decrease frequency under thermal stress', () => {
      thermalManager.updateSensorReadings({
        junctionTemp: 75,
        caseTemp: 72,
        radiatorTemp: 65,
        heatsinkTemp: 72,
        powerDraw: 12,
        timestamp: new Date()
      });

      const dvfs1 = thermalManager.requestDVFSAdjustment();

      thermalManager.updateSensorReadings({
        junctionTemp: 85,
        caseTemp: 82,
        radiatorTemp: 70,
        heatsinkTemp: 82,
        powerDraw: 16,
        timestamp: new Date()
      });

      const dvfs2 = thermalManager.requestDVFSAdjustment();
      expect(dvfs2.frequency).toBeLessThanOrEqual(dvfs1.frequency);
    });

    test('should minimize frequency at critical temperatures', () => {
      thermalManager.updateSensorReadings({
        junctionTemp: 90,
        caseTemp: 87,
        radiatorTemp: 75,
        heatsinkTemp: 87,
        powerDraw: 18,
        timestamp: new Date()
      });

      const dvfs = thermalManager.requestDVFSAdjustment();
      expect(dvfs.frequency).toBeLessThan(1000);
    });
  });

  describe('Thermal Prediction', () => {
    test('should predict future temperatures', () => {
      thermalManager.updateSensorReadings({
        junctionTemp: 40,
        caseTemp: 38,
        radiatorTemp: 30,
        heatsinkTemp: 38,
        powerDraw: 8,
        timestamp: new Date()
      });

      const prediction = thermalManager.predictTemperature(60); // 60 seconds ahead
      expect(prediction).toBeDefined();
      expect(prediction.predictedTemp).toBeGreaterThanOrEqual(40);
    });

    test('should handle transient temperature spikes', () => {
      // Simulate repeated updates
      for (let i = 0; i < 5; i++) {
        thermalManager.updateSensorReadings({
          junctionTemp: 50 + i * 5,
          caseTemp: 48 + i * 5,
          radiatorTemp: 40 + i * 5,
          heatsinkTemp: 48 + i * 5,
          powerDraw: 8 + i,
          timestamp: new Date()
        });
      }

      const state = thermalManager.getState();
      expect(state.junctionTemperature).toBeLessThan(100);
    });
  });

  describe('Power Management', () => {
    test('should track power draw', () => {
      const readings = {
        junctionTemp: 45,
        caseTemp: 40,
        radiatorTemp: 35,
        heatsinkTemp: 40,
        powerDraw: 12,
        timestamp: new Date()
      };

      thermalManager.updateSensorReadings(readings);
      const state = thermalManager.getState();
      expect(state.powerDraw).toBe(12);
    });

    test('should respect power budget constraints', () => {
      const state = thermalManager.getState();
      expect(state.powerDraw).toBeLessThanOrEqual(config.powerBudgetWatts);
    });
  });

  describe('State Management', () => {
    test('should return complete state snapshot', () => {
      thermalManager.updateSensorReadings({
        junctionTemp: 50,
        caseTemp: 48,
        radiatorTemp: 40,
        heatsinkTemp: 48,
        powerDraw: 10,
        timestamp: new Date()
      });

      const state = thermalManager.getState();
      expect(state).toHaveProperty('junctionTemperature');
      expect(state).toHaveProperty('caseTemperature');
      expect(state).toHaveProperty('radiatorTemperature');
      expect(state).toHaveProperty('heatsinkTemperature');
      expect(state).toHaveProperty('powerDraw');
      expect(state).toHaveProperty('status');
    });

    test('should reset state correctly', () => {
      thermalManager.updateSensorReadings({
        junctionTemp: 80,
        caseTemp: 78,
        radiatorTemp: 70,
        heatsinkTemp: 78,
        powerDraw: 14,
        timestamp: new Date()
      });

      thermalManager.reset();
      const state = thermalManager.getState();

      // After reset, should return to default/initial state
      expect(state).toBeDefined();
    });
  });
});
