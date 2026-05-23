/**
 * OrbitalMind Control Plane Orchestrator
 * Centralized system for satellite management and workload distribution
 */

import {
  SatelliteID,
  InferenceTaskID,
  HealthMetrics,
  HealthStatus,
  ConstellationState,
  createSatelliteID,
  createInferenceTaskID
} from '@orbitalmind/shared';

export enum TaskAllocationStrategy {
  RoundRobin = 'round-robin',
  ThermalAware = 'thermal-aware',
  AvailabilityAware = 'availability-aware',
  PowerAware = 'power-aware',
  OptimalDistance = 'optimal-distance'
}

export interface AllocationDecision {
  taskID: InferenceTaskID;
  assignedSatellite: SatelliteID;
  strategy: TaskAllocationStrategy;
  reason: string;
  alternates: SatelliteID[];
}

export interface ConstellationStatistics {
  totalSatellites: number;
  healthySatellites: number;
  degradedSatellites: number;
  offlineSatellites: number;
  averageTemperature: number;
  totalAvailablePower: number;
  totalAvailableCompute: number;
  networkConnectivity: number;  // 0-100%
}

/**
 * Control plane orchestrator
 */
export class Orchestrator {
  private constellationState: ConstellationState | null = null;
  private allocationStrategy: TaskAllocationStrategy = TaskAllocationStrategy.ThermalAware;
  private lastAllocationIndex: number = 0;

  /**
   * Update constellation state
   */
  public updateConstellationState(state: ConstellationState): void {
    this.constellationState = state;
  }

  /**
   * Allocate task to optimal satellite
   */
  public allocateTask(
    taskID: InferenceTaskID,
    modelSize: number,
    estimatedPower: number
  ): AllocationDecision {
    if (!this.constellationState) {
      throw new Error('Constellation state not available');
    }

    let assignedSatellite: SatelliteID;
    let reason: string;
    const alternates: SatelliteID[] = [];

    switch (this.allocationStrategy) {
      case TaskAllocationStrategy.ThermalAware:
        const thermalResult = this.allocateThermalAware(estimatedPower);
        assignedSatellite = thermalResult.primary;
        alternates.push(...thermalResult.alternates);
        reason = `Assigned to ${assignedSatellite} for thermal capacity`;
        break;

      case TaskAllocationStrategy.PowerAware:
        const powerResult = this.allocatePowerAware(estimatedPower);
        assignedSatellite = powerResult.primary;
        alternates.push(...powerResult.alternates);
        reason = `Assigned to ${assignedSatellite} for power availability`;
        break;

      case TaskAllocationStrategy.RoundRobin:
        const rrResult = this.allocateRoundRobin();
        assignedSatellite = rrResult.primary;
        alternates.push(...rrResult.alternates);
        reason = `Round-robin allocation to ${assignedSatellite}`;
        break;

      default:
        assignedSatellite = Array.from(this.constellationState.satellites.keys())[0];
        reason = 'Default allocation';
    }

    return {
      taskID,
      assignedSatellite,
      strategy: this.allocationStrategy,
      reason,
      alternates
    };
  }

  /**
   * Allocate task considering thermal budget
   */
  private allocateThermalAware(estimatedPower: number) {
    const satellites = Array.from(this.constellationState!.globalThermalState.entries())
      .map(([satID, thermal]) => ({
        satID,
        thermalMargin: thermal.thermalMargin,
        availablePower: Math.max(0, thermal.thermalMargin / 10)  // Simplified conversion
      }))
      .sort((a, b) => b.availablePower - a.availablePower);

    return {
      primary: satellites[0]?.satID || createSatelliteID('SAT-001'),
      alternates: satellites.slice(1, 3).map(s => s.satID)
    };
  }

  /**
   * Allocate task considering power budget
   */
  private allocatePowerAware(estimatedPower: number) {
    const satellites = Array.from(this.constellationState!.satellites.entries())
      .map(([satID, health]) => ({
        satID,
        availablePower: health.powerBudgetRemaining
      }))
      .filter(s => s.availablePower > estimatedPower)
      .sort((a, b) => b.availablePower - a.availablePower);

    return {
      primary: satellites[0]?.satID || createSatelliteID('SAT-001'),
      alternates: satellites.slice(1, 3).map(s => s.satID)
    };
  }

  /**
   * Round-robin allocation
   */
  private allocateRoundRobin() {
    const satellites = Array.from(this.constellationState!.satellites.keys());
    const primary = satellites[this.lastAllocationIndex % satellites.length];
    this.lastAllocationIndex++;

    const alternates = satellites
      .filter(s => s !== primary)
      .slice(0, 2);

    return { primary, alternates };
  }

  /**
   * Get constellation statistics
   */
  public getConstellationStatistics(): ConstellationStatistics {
    if (!this.constellationState) {
      return {
        totalSatellites: 0,
        healthySatellites: 0,
        degradedSatellites: 0,
        offlineSatellites: 0,
        averageTemperature: 0,
        totalAvailablePower: 0,
        totalAvailableCompute: 0,
        networkConnectivity: 0
      };
    }

    let healthy = 0, degraded = 0, offline = 0;
    let totalTemp = 0, totalPower = 0, totalCompute = 0;

    for (const health of this.constellationState.satellites.values()) {
      if (health.status === HealthStatus.Healthy) healthy++;
      else if (health.status === HealthStatus.Degraded) degraded++;
      else if (health.status === HealthStatus.Offline) offline++;

      totalTemp += health.cpuTemperature;
      totalPower += health.powerBudgetRemaining;
      totalCompute += health.availableInferenceCapacity;
    }

    const total = this.constellationState.satellites.size;

    return {
      totalSatellites: total,
      healthySatellites: healthy,
      degradedSatellites: degraded,
      offlineSatellites: offline,
      averageTemperature: total > 0 ? totalTemp / total : 0,
      totalAvailablePower: totalPower,
      totalAvailableCompute: totalCompute,
      networkConnectivity: this.constellationState.topology.edges.length > 0 ? 95 : 0
    };
  }

  /**
   * Detect anomalies in constellation state
   */
  public detectAnomalies(): Array<{type: string; severity: string; description: string}> {
    const anomalies: Array<{type: string; severity: string; description: string}> = [];

    if (!this.constellationState) return anomalies;

    for (const [satID, health] of this.constellationState.satellites) {
      if (health.cpuTemperature > 75) {
        anomalies.push({
          type: 'high-temperature',
          severity: 'high',
          description: `${satID} temperature: ${health.cpuTemperature}°C`
        });
      }

      if (health.seuCount24h > 100) {
        anomalies.push({
          type: 'high-seu-rate',
          severity: 'medium',
          description: `${satID} SEU count: ${health.seuCount24h}/24h`
        });
      }

      if (health.batterySOC < 20) {
        anomalies.push({
          type: 'low-battery',
          severity: 'medium',
          description: `${satID} battery SOC: ${health.batterySOC}%`
        });
      }
    }

    return anomalies;
  }

  /**
   * Set allocation strategy
   */
  public setAllocationStrategy(strategy: TaskAllocationStrategy): void {
    this.allocationStrategy = strategy;
  }

  /**
   * Recommend rebalancing of loads
   */
  public recommendRebalancing(): Array<{from: SatelliteID; to: SatelliteID; reason: string}> {
    const recommendations: Array<{from: SatelliteID; to: SatelliteID; reason: string}> = [];

    if (!this.constellationState) return recommendations;

    // Find overloaded satellites
    const overloaded = Array.from(this.constellationState.satellites.entries())
      .filter(([_, health]) => health.utilizationCPU > 80)
      .map(([satID, _]) => satID);

    // Find underutilized satellites
    const underutilized = Array.from(this.constellationState.satellites.entries())
      .filter(([_, health]) => health.utilizationCPU < 30)
      .map(([satID, _]) => satID);

    // Create recommendations
    for (let i = 0; i < Math.min(overloaded.length, underutilized.length); i++) {
      recommendations.push({
        from: overloaded[i],
        to: underutilized[i],
        reason: `Rebalance: ${overloaded[i]} (${this.constellationState.satellites.get(overloaded[i])?.utilizationCPU}%) → ${underutilized[i]}`
      });
    }

    return recommendations;
  }
}
