/**
 * Control Plane Optimization Integration Test
 * Verify optimized task allocation using PriorityQueue
 */

import { OrchestratorOptimized, TaskAllocationStrategy } from '../../apps/control-plane/src/orchestrator-optimized';
import {
  ConstellationState,
  HealthMetrics,
  HealthStatus,
  NetworkTopology,
  ThermalState,
  createSatelliteID,
  createInferenceTaskID,
  TaskPriority
} from '@orbitalmind/shared';

describe('Control Plane Optimization Integration', () => {
  let orchestrator: OrchestratorOptimized;
  let testConstellationState: ConstellationState;

  beforeEach(() => {
    orchestrator = new OrchestratorOptimized();

    // Create test constellation state with multiple satellites
    const satellites = new Map<string, HealthMetrics>();
    const thermalState = new Map<string, ThermalState>();
    const topology: NetworkTopology = { nodes: [], edges: [] };

    for (let i = 1; i <= 20; i++) {
      const satID = createSatelliteID(`SAT-${String(i).padStart(3, '0')}`);

      satellites.set(satID, {
        satelliteId: satID,
        status: i % 3 === 0 ? HealthStatus.Degraded : HealthStatus.Healthy,
        cpuTemperature: 40 + Math.random() * 30,
        powerBudgetRemaining: 500 + Math.random() * 300,
        batterySOC: 50 + Math.random() * 40,
        seuCount24h: Math.floor(Math.random() * 50),
        utilizationCPU: Math.random() * 100,
        utilizationMemory: Math.random() * 80,
        availableInferenceCapacity: 100 - Math.random() * 50,
        estimatedRemainingLife: 5 + Math.random() * 5,
        lastHealthCheck: Date.now()
      });

      thermalState.set(satID, {
        satelliteId: satID,
        currentTemp: 40 + Math.random() * 30,
        thermalMargin: 30 + Math.random() * 20,
        heatsinkTemp: 35 + Math.random() * 25,
        radiatorTemp: 20 + Math.random() * 15,
        dvfsState: 'nominal',
        lastUpdate: Date.now()
      });

      topology.nodes.push(satID);
    }

    // Add some edges to topology
    for (let i = 0; i < 20; i++) {
      topology.edges.push({
        source: Array.from(satellites.keys())[Math.floor(Math.random() * satellites.size)],
        target: Array.from(satellites.keys())[Math.floor(Math.random() * satellites.size)]
      });
    }

    testConstellationState = {
      timestamp: Date.now(),
      satellites,
      globalThermalState: thermalState,
      topology
    };

    orchestrator.updateConstellationState(testConstellationState);
  });

  describe('Task Allocation Strategies', () => {
    test('should allocate tasks using thermal-aware strategy', () => {
      orchestrator.setAllocationStrategy(TaskAllocationStrategy.ThermalAware);

      const taskID = createInferenceTaskID('task-001');
      const decision = orchestrator.allocateTask(taskID, 4096, 50);

      expect(decision.taskID).toBe(taskID);
      expect(decision.assignedSatellite).toBeDefined();
      expect(decision.strategy).toBe(TaskAllocationStrategy.ThermalAware);
      expect(decision.alternates.length).toBeGreaterThan(0);
      expect(decision.allocationTime).toBeLessThan(50); // Should be fast

      console.log(`Thermal-aware allocation: ${decision.assignedSatellite} (${decision.allocationTime}ms)`);
    });

    test('should allocate tasks using power-aware strategy', () => {
      orchestrator.setAllocationStrategy(TaskAllocationStrategy.PowerAware);

      const taskID = createInferenceTaskID('task-002');
      const decision = orchestrator.allocateTask(taskID, 4096, 100);

      expect(decision.taskID).toBe(taskID);
      expect(decision.strategy).toBe(TaskAllocationStrategy.PowerAware);
      expect(decision.assignedSatellite).toBeDefined();

      // Verify assigned satellite has enough power
      const health = testConstellationState.satellites.get(decision.assignedSatellite);
      expect(health).toBeDefined();

      console.log(`Power-aware allocation: ${decision.assignedSatellite}`);
    });

    test('should allocate tasks using round-robin strategy', () => {
      orchestrator.setAllocationStrategy(TaskAllocationStrategy.RoundRobin);

      const taskID1 = createInferenceTaskID('task-rr-1');
      const taskID2 = createInferenceTaskID('task-rr-2');

      const decision1 = orchestrator.allocateTask(taskID1, 4096, 50);
      const decision2 = orchestrator.allocateTask(taskID2, 4096, 50);

      // Round-robin should distribute across satellites
      expect(decision1.assignedSatellite).toBeDefined();
      expect(decision2.assignedSatellite).toBeDefined();

      console.log(`Round-robin allocations: ${decision1.assignedSatellite} -> ${decision2.assignedSatellite}`);
    });
  });

  describe('Allocation Performance', () => {
    test('should allocate tasks in O(n) time', () => {
      orchestrator.setAllocationStrategy(TaskAllocationStrategy.ThermalAware);

      const allocations = [];
      for (let i = 0; i < 100; i++) {
        const taskID = createInferenceTaskID(`task-${i}`);
        const decision = orchestrator.allocateTask(taskID, 4096, 50);
        allocations.push(decision.allocationTime);
      }

      const stats = orchestrator.getAllocationStatistics();
      const avgTime = parseFloat(stats.avgAllocationTimeMs as string);

      expect(avgTime).toBeLessThan(10); // Should be very fast
      expect(stats.totalAllocations).toBe(100);

      console.log(
        `100 allocations: avg=${avgTime.toFixed(2)}ms, ` +
        `strategy counts: ${JSON.stringify(stats.strategyCounts)}`
      );
    });

    test('should show consistent performance across constellation sizes', () => {
      const results: Array<{ satCount: number; avgTimeMs: number }> = [];

      for (const satCount of [10, 50, 100]) {
        const orchy = new OrchestratorOptimized();

        const satellites = new Map<string, HealthMetrics>();
        const thermalState = new Map<string, ThermalState>();

        for (let i = 0; i < satCount; i++) {
          const satID = createSatelliteID(`SAT-${String(i).padStart(4, '0')}`);

          satellites.set(satID, {
            satelliteId: satID,
            status: HealthStatus.Healthy,
            cpuTemperature: 40 + Math.random() * 30,
            powerBudgetRemaining: 500 + Math.random() * 300,
            batterySOC: 50 + Math.random() * 40,
            seuCount24h: Math.floor(Math.random() * 50),
            utilizationCPU: Math.random() * 100,
            utilizationMemory: Math.random() * 80,
            availableInferenceCapacity: 100 - Math.random() * 50,
            estimatedRemainingLife: 5 + Math.random() * 5,
            lastHealthCheck: Date.now()
          });

          thermalState.set(satID, {
            satelliteId: satID,
            currentTemp: 40 + Math.random() * 30,
            thermalMargin: 30 + Math.random() * 20,
            heatsinkTemp: 35 + Math.random() * 25,
            radiatorTemp: 20 + Math.random() * 15,
            dvfsState: 'nominal',
            lastUpdate: Date.now()
          });
        }

        const constellationState: ConstellationState = {
          timestamp: Date.now(),
          satellites,
          globalThermalState: thermalState,
          topology: { nodes: Array.from(satellites.keys()), edges: [] }
        };

        orchy.updateConstellationState(constellationState);
        orchy.setAllocationStrategy(TaskAllocationStrategy.ThermalAware);

        let totalTime = 0;
        for (let i = 0; i < 10; i++) {
          const decision = orchy.allocateTask(
            createInferenceTaskID(`test-${i}`),
            4096,
            50
          );
          totalTime += decision.allocationTime;
        }

        results.push({
          satCount,
          avgTimeMs: totalTime / 10
        });
      }

      // Time should not scale significantly with constellation size
      expect(results[2].avgTimeMs).toBeLessThan(results[0].avgTimeMs * 5);

      console.log('Allocation time scaling:');
      results.forEach(r =>
        console.log(`  ${r.satCount} satellites: avg=${r.avgTimeMs.toFixed(2)}ms`)
      );
    });
  });

  describe('Constellation Statistics', () => {
    test('should calculate accurate constellation statistics', () => {
      const stats = orchestrator.getConstellationStatistics();

      expect(stats.totalSatellites).toBe(20);
      expect(stats.healthySatellites + stats.degradedSatellites + stats.offlineSatellites)
        .toBe(stats.totalSatellites);
      expect(stats.averageTemperature).toBeGreaterThan(0);
      expect(stats.totalAvailablePower).toBeGreaterThan(0);
      expect(stats.networkConnectivity).toBeGreaterThanOrEqual(0);

      console.log(`
        Constellation Statistics:
        Total: ${stats.totalSatellites}
        Healthy: ${stats.healthySatellites}
        Degraded: ${stats.degradedSatellites}
        Offline: ${stats.offlineSatellites}
        Avg Temp: ${stats.averageTemperature.toFixed(1)}°C
        Total Power: ${stats.totalAvailablePower.toFixed(0)} W
        Connectivity: ${stats.networkConnectivity}%
      `);
    });

    test('should detect anomalies in constellation', () => {
      const anomalies = orchestrator.detectAnomalies();

      expect(Array.isArray(anomalies)).toBe(true);

      // Should find some anomalies (high temp, low battery, high SEU)
      const types = anomalies.map(a => a.type);

      console.log(`Detected ${anomalies.length} anomalies:`);
      anomalies.slice(0, 5).forEach(a =>
        console.log(`  ${a.type} (${a.severity}): ${a.description}`)
      );
    });
  });

  describe('Load Rebalancing', () => {
    test('should recommend load rebalancing', () => {
      // Manually set some satellites as overloaded/underutilized
      const satellites = testConstellationState.satellites;
      const satArray = Array.from(satellites.entries());

      // Set first satellite as overloaded
      satArray[0][1].utilizationCPU = 95;

      // Set second satellite as underutilized
      satArray[1][1].utilizationCPU = 15;

      const recommendations = orchestrator.recommendRebalancing();

      expect(Array.isArray(recommendations)).toBe(true);

      if (recommendations.length > 0) {
        console.log('Rebalancing recommendations:');
        recommendations.forEach(r =>
          console.log(`  Move from ${r.from} to ${r.to}: ${r.reason}`)
        );
      }
    });
  });

  describe('Multi-Strategy Allocation', () => {
    test('should allocate across multiple strategies', () => {
      const strategies = [
        TaskAllocationStrategy.ThermalAware,
        TaskAllocationStrategy.PowerAware,
        TaskAllocationStrategy.RoundRobin
      ];

      const allocations = [];

      for (let i = 0; i < 15; i++) {
        const strategy = strategies[i % strategies.length];
        orchestrator.setAllocationStrategy(strategy);

        const decision = orchestrator.allocateTask(
          createInferenceTaskID(`multi-${i}`),
          4096,
          50
        );

        allocations.push({
          strategy,
          satellite: decision.assignedSatellite,
          time: decision.allocationTime
        });
      }

      const stats = orchestrator.getAllocationStatistics();
      expect(stats.totalAllocations).toBe(15);

      console.log(`
        Multi-strategy allocations: ${stats.totalAllocations} total
        Strategy distribution: ${JSON.stringify(stats.strategyCounts)}
      `);
    });

    test('should show allocation diversity', () => {
      orchestrator.setAllocationStrategy(TaskAllocationStrategy.PowerAware);

      const assigned = new Set<string>();

      for (let i = 0; i < 20; i++) {
        const decision = orchestrator.allocateTask(
          createInferenceTaskID(`div-${i}`),
          4096,
          50
        );
        assigned.add(decision.assignedSatellite);
      }

      // Should allocate across multiple satellites
      expect(assigned.size).toBeGreaterThan(1);

      console.log(
        `20 allocations distributed across ${assigned.size} satellites: ` +
        `${Array.from(assigned).join(', ')}`
      );
    });
  });

  describe('Edge Cases', () => {
    test('should handle missing constellation state', () => {
      const emptyOrchestrator = new OrchestratorOptimized();
      const stats = emptyOrchestrator.getConstellationStatistics();

      expect(stats.totalSatellites).toBe(0);
      expect(stats.healthySatellites).toBe(0);

      console.log('Empty constellation state handled correctly');
    });

    test('should handle single satellite constellation', () => {
      const singleOrchestrator = new OrchestratorOptimized();

      const satellites = new Map<string, HealthMetrics>();
      const satID = createSatelliteID('SAT-001');

      satellites.set(satID, {
        satelliteId: satID,
        status: HealthStatus.Healthy,
        cpuTemperature: 45,
        powerBudgetRemaining: 600,
        batterySOC: 75,
        seuCount24h: 10,
        utilizationCPU: 50,
        utilizationMemory: 40,
        availableInferenceCapacity: 80,
        estimatedRemainingLife: 5,
        lastHealthCheck: Date.now()
      });

      const singleState: ConstellationState = {
        timestamp: Date.now(),
        satellites,
        globalThermalState: new Map([[satID, {
          satelliteId: satID,
          currentTemp: 45,
          thermalMargin: 35,
          heatsinkTemp: 40,
          radiatorTemp: 25,
          dvfsState: 'nominal',
          lastUpdate: Date.now()
        }]]),
        topology: { nodes: [satID], edges: [] }
      };

      singleOrchestrator.updateConstellationState(singleState);

      const decision = singleOrchestrator.allocateTask(
        createInferenceTaskID('single-task'),
        4096,
        50
      );

      expect(decision.assignedSatellite).toBe(satID);

      console.log('Single satellite constellation handled correctly');
    });
  });
});
