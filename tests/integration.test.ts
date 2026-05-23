/**
 * OrbitalMind Integration Tests
 * Test core systems working together
 */

import {
  createSatelliteID,
  createInferenceTaskID,
  createModelID,
  TaskPriority,
  ThermalStatus,
  HealthStatus,
  SystemConfig
} from '@orbitalmind/shared';

import { ThermalManager } from '@orbitalmind/thermal-engine';
import { RadiationManager } from '@orbitalmind/radiation-runtime';
import { InferenceEngine } from '@orbitalmind/inference-runtime';
import { NetworkManager } from '@orbitalmind/orbital-networking';
import { AutonomyEngine } from '@orbitalmind/autonomy-core';

describe('OrbitalMind Integration Tests', () => {
  let config: SystemConfig;
  let thermalManager: ThermalManager;
  let radiationManager: RadiationManager;
  let inferenceEngine: InferenceEngine;
  let networkManager: NetworkManager;
  let autonomyEngine: AutonomyEngine;

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
    radiationManager = new RadiationManager();
    inferenceEngine = new InferenceEngine(thermalManager, radiationManager);
    networkManager = new NetworkManager(createSatelliteID('SAT-001'));
    autonomyEngine = new AutonomyEngine(createSatelliteID('SAT-001'));
  });

  test('Thermal management updates correctly', () => {
    thermalManager.updateSensorReadings({
      junctionTemp: 45,
      caseTemp: 40,
      radiatorTemp: 35,
      heatsinkTemp: 40,
      powerDraw: 8,
      timestamp: new Date()
    });

    const state = thermalManager.getState();
    expect(state.status).toBe(ThermalStatus.Normal);
    expect(state.junctionTemperature).toBe(45);
  });

  test('DVFS adjustment works under thermal stress', () => {
    // Normal temperature
    thermalManager.updateSensorReadings({
      junctionTemp: 30,
      caseTemp: 28,
      radiatorTemp: 25,
      heatsinkTemp: 28,
      powerDraw: 5,
      timestamp: new Date()
    });

    let dvfs = thermalManager.requestDVFSAdjustment();
    expect(dvfs.frequency).toBeGreaterThan(1400);

    // Warning temperature
    thermalManager.updateSensorReadings({
      junctionTemp: 75,
      caseTemp: 72,
      radiatorTemp: 65,
      heatsinkTemp: 72,
      powerDraw: 12,
      timestamp: new Date()
    });

    dvfs = thermalManager.requestDVFSAdjustment();
    expect(dvfs.frequency).toBeLessThan(1500);
  });

  test('Radiation memory protection works', () => {
    const address = 0x1000;
    const size = 256;

    radiationManager.registerMemoryBlock(address, size);

    const data = Buffer.alloc(size, 0xAA);
    radiationManager.writeMemory(address, data);

    const readData = radiationManager.readMemory(address);
    expect(readData.length).toBe(size);
  });

  test('Checkpoint creation and restoration works', () => {
    const taskID = createInferenceTaskID('task-001');
    const modelState = Buffer.alloc(100, 0xFF);
    const inputBuffer = Buffer.alloc(50, 0x00);
    const computeState = Buffer.alloc(200, 0xAA);

    const checkpoint = radiationManager.createCheckpoint(
      taskID,
      0,
      modelState,
      inputBuffer,
      computeState
    );

    expect(checkpoint.taskID).toBe(taskID);
    expect(checkpoint.iteration).toBe(0);

    const restored = radiationManager.restoreCheckpoint(taskID);
    expect(restored).not.toBeNull();
    expect(restored!.taskID).toBe(taskID);
  });

  test('Inference task submission and processing', () => {
    const modelID = 'model-001';
    const input = Buffer.alloc(100);

    const taskID = inferenceEngine.submitTask(input, modelID, TaskPriority.High);
    expect(taskID).toBeDefined();

    const stats = inferenceEngine.getStatistics();
    expect(stats.currentQueueLength).toBeGreaterThanOrEqual(1);
  });

  test('Network routing computation works', () => {
    const topology = {
      edges: [
        { from: createSatelliteID('SAT-001'), to: createSatelliteID('SAT-002'), type: 'oisl' as const, quality: 95, bandwidth: 50, latency: 2, active: true },
        { from: createSatelliteID('SAT-002'), to: createSatelliteID('SAT-003'), type: 'oisl' as const, quality: 90, bandwidth: 40, latency: 2, active: true }
      ],
      nodes: new Map([
        [createSatelliteID('SAT-001'), { latitude: 0, longitude: 0, altitude: 600, timestamp: new Date() }],
        [createSatelliteID('SAT-002'), { latitude: 1, longitude: 1, altitude: 600, timestamp: new Date() }],
        [createSatelliteID('SAT-003'), { latitude: 2, longitude: 2, altitude: 600, timestamp: new Date() }]
      ]),
      timestamp: new Date()
    };

    networkManager.updateTopology(topology);
    const stats = networkManager.getRoutingStatistics();
    expect(stats.totalSatellites).toBe(3);
  });

  test('Autonomy engine collision avoidance detection', () => {
    const position = { latitude: 0, longitude: 0, altitude: 600, timestamp: new Date() };
    const threats = [
      { latitude: 0.01, longitude: 0, altitude: 600, timestamp: new Date() }
    ];

    autonomyEngine.updateState(position, {
      satelliteID: createSatelliteID('SAT-001'),
      timestamp: new Date(),
      cpuTemperature: 45,
      caseTemperature: 40,
      radiatorTemperature: 35,
      inputVoltage: 3.3,
      currentDraw: 1.5,
      batterySOC: 75,
      powerBudgetRemaining: 12,
      seuCount24h: 2,
      criticalMemoryErrors: 0,
      availableInterSatelliteLinks: 4,
      availableGroundLinks: 1,
      utilizationCPU: 35,
      utilizationMemory: 45,
      availableInferenceCapacity: 6,
      status: HealthStatus.Healthy,
      lastCommandTime: new Date()
    });

    const decision = autonomyEngine.evaluateCollisionRisk(threats, 1.0);
    expect(decision.threatDetected).toBe(true);
  });
});
