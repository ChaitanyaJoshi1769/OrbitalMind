/**
 * OrbitalMind Autonomous Spacecraft Intelligence
 * Autonomous decision-making and mission planning
 */

import {
  SatelliteID,
  OrbitalPosition,
  HealthMetrics,
  HealthStatus
} from '@orbitalmind/shared';

export interface AutonomyState {
  operatingMode: OperatingMode;
  missionStatus: MissionStatus;
  autonomyLevel: number;  // 0-100%
  isExecutingPlan: boolean;
}

export enum OperatingMode {
  Nominal = 'nominal',
  Degraded = 'degraded',
  Emergency = 'emergency',
  Autonomous = 'autonomous',
  Offline = 'offline'
}

export enum MissionStatus {
  Idle = 'idle',
  Planning = 'planning',
  Executing = 'executing',
  Completed = 'completed',
  Failed = 'failed'
}

export interface NavigationPlan {
  waypoints: OrbitalPosition[];
  targetAltitude: number;
  targetInclination: number;
  estimatedTime: number;  // seconds
  deltaV: number;         // km/s
}

export interface CollisionAvoidanceDecision {
  threatDetected: boolean;
  threatDistance: number;  // km
  recommendedAction: string;
  autonomousAction?: string;
}

/**
 * Main autonomy engine for spacecraft decision-making
 */
export class AutonomyEngine {
  private state: AutonomyState;
  private satelliteID: SatelliteID;
  private currentPosition: OrbitalPosition | null = null;
  private healthMetrics: HealthMetrics | null = null;
  private autonomyLevel: number = 100;

  constructor(satelliteID: SatelliteID) {
    this.satelliteID = satelliteID;
    this.state = {
      operatingMode: OperatingMode.Nominal,
      missionStatus: MissionStatus.Idle,
      autonomyLevel: this.autonomyLevel,
      isExecutingPlan: false
    };
  }

  /**
   * Update satellite state
   */
  public updateState(position: OrbitalPosition, health: HealthMetrics): void {
    this.currentPosition = position;
    this.healthMetrics = health;

    // Adjust autonomy level based on health
    this.updateAutonomyLevel(health);

    // Update operating mode
    this.updateOperatingMode(health);
  }

  /**
   * Update autonomy level based on spacecraft health
   */
  private updateAutonomyLevel(health: HealthMetrics): void {
    const baseAutonomy = 100;
    let reduction = 0;

    if (health.status === HealthStatus.Degraded) {
      reduction += 20;
    } else if (health.status === HealthStatus.Critical) {
      reduction += 50;
    } else if (health.status === HealthStatus.Offline) {
      reduction += 100;
    }

    // Reduce autonomy if thermal issues
    if (health.cpuTemperature > 70) {
      reduction += 10;
    }

    // Reduce autonomy if power-limited
    if (health.powerBudgetRemaining < 5) {
      reduction += 15;
    }

    this.autonomyLevel = Math.max(0, baseAutonomy - reduction);
    this.state.autonomyLevel = this.autonomyLevel;
  }

  /**
   * Update operating mode
   */
  private updateOperatingMode(health: HealthMetrics): void {
    if (health.status === HealthStatus.Offline) {
      this.state.operatingMode = OperatingMode.Offline;
    } else if (health.status === HealthStatus.Critical) {
      this.state.operatingMode = OperatingMode.Emergency;
    } else if (health.status === HealthStatus.Degraded) {
      this.state.operatingMode = OperatingMode.Degraded;
    } else if (this.autonomyLevel > 80) {
      this.state.operatingMode = OperatingMode.Autonomous;
    } else {
      this.state.operatingMode = OperatingMode.Nominal;
    }
  }

  /**
   * Collision avoidance decision-making
   */
  public evaluateCollisionRisk(
    threats: OrbitalPosition[],
    safeDistance: number = 1.0  // km
  ): CollisionAvoidanceDecision {
    if (!this.currentPosition) {
      return {
        threatDetected: false,
        threatDistance: Infinity,
        recommendedAction: 'No position data'
      };
    }

    let minDistance = Infinity;
    let closestThreat: OrbitalPosition | null = null;

    for (const threat of threats) {
      const distance = this.calculateDistance(this.currentPosition, threat);
      if (distance < minDistance) {
        minDistance = distance;
        closestThreat = threat;
      }
    }

    const threatDetected = minDistance < safeDistance;

    let recommendedAction = 'No action required';
    let autonomousAction: string | undefined;

    if (threatDetected) {
      recommendedAction = `Threat at ${minDistance.toFixed(1)}km, recommend evasive maneuver`;

      // Autonomous action if autonomy level is high
      if (this.autonomyLevel > 85) {
        autonomousAction = `Executing autonomous evasion: adjust orbit by ${(safeDistance - minDistance).toFixed(2)}km`;
      }
    }

    return {
      threatDetected,
      threatDistance: minDistance,
      recommendedAction,
      autonomousAction
    };
  }

  /**
   * Calculate orbital distance
   */
  private calculateDistance(pos1: OrbitalPosition, pos2: OrbitalPosition): number {
    // Simplified: use 2D distance (ignoring altitude difference)
    const R = 6371; // Earth radius
    const lat1Rad = pos1.latitude * Math.PI / 180;
    const lat2Rad = pos2.latitude * Math.PI / 180;
    const dLat = (pos2.latitude - pos1.latitude) * Math.PI / 180;
    const dLon = (pos2.longitude - pos1.longitude) * Math.PI / 180;

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1Rad) * Math.cos(lat2Rad) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c;
  }

  /**
   * Plan navigation maneuver
   */
  public planNavigation(
    targetAltitude: number,
    targetInclination: number
  ): NavigationPlan {
    if (!this.currentPosition) {
      return {
        waypoints: [],
        targetAltitude,
        targetInclination,
        estimatedTime: 0,
        deltaV: 0
      };
    }

    // Simplified Hohmann transfer calculation
    const currentAltitude = this.currentPosition.altitude;
    const altitudeDelta = Math.abs(targetAltitude - currentAltitude);

    // Hohmann transfer: ΔV ≈ √(μ/r1) * (√(2r2/(r1+r2)) - 1)
    const mu = 398600; // km³/s² (Earth's GM)
    const r1 = 6371 + currentAltitude;
    const r2 = 6371 + targetAltitude;

    const v1 = Math.sqrt(mu / r1);
    const v2 = Math.sqrt(2 * mu * r2 / (r1 * (r1 + r2)));
    const deltaV = Math.abs(v2 - v1);

    const orbitalPeriod = 2 * Math.PI * Math.sqrt(Math.pow((r1 + r2) / 2, 3) / mu);
    const transferTime = orbitalPeriod / 2;

    return {
      waypoints: [this.currentPosition],
      targetAltitude,
      targetInclination,
      estimatedTime: transferTime,
      deltaV
    };
  }

  /**
   * Autonomy decision for power-constrained operations
   */
  public optimizePowerConsumption(availablePower: number): string {
    if (availablePower > 10) {
      return 'Full inference and autonomy enabled';
    } else if (availablePower > 5) {
      return 'Reduced inference frequency, autonomy active';
    } else if (availablePower > 2) {
      return 'Minimal inference, critical autonomy only';
    } else {
      return 'Autonomous minimal mode, all non-critical systems disabled';
    }
  }

  /**
   * Get current autonomy state
   */
  public getState(): AutonomyState {
    return { ...this.state };
  }

  /**
   * Get autonomy diagnostics
   */
  public getDiagnostics() {
    return {
      autonomyLevel: this.autonomyLevel,
      operatingMode: this.state.operatingMode,
      canExecuteAutonomousManeuvers: this.autonomyLevel > 75,
      canMakeCriticalDecisions: this.autonomyLevel > 85,
      requiresGroundControl: this.autonomyLevel < 50
    };
  }
}

/**
 * Reinforcement learning-based autonomous optimization
 */
export class AdaptiveAutonomyController {
  private qTable: Map<string, Map<string, number>> = new Map();
  private learningRate: number = 0.1;
  private discountFactor: number = 0.9;

  /**
   * Learn from experience
   */
  public learnAction(
    state: string,
    action: string,
    reward: number,
    nextState: string
  ): void {
    if (!this.qTable.has(state)) {
      this.qTable.set(state, new Map());
    }

    const stateMap = this.qTable.get(state)!;
    const currentQ = stateMap.get(action) ?? 0;

    // Find max Q for next state
    const nextStateMap = this.qTable.get(nextState) ?? new Map();
    const maxNextQ = Math.max(...Array.from(nextStateMap.values()), 0);

    // Q-learning update
    const newQ = currentQ + this.learningRate *
                 (reward + this.discountFactor * maxNextQ - currentQ);

    stateMap.set(action, newQ);
  }

  /**
   * Select best action for state
   */
  public selectAction(state: string, epsilon: number = 0.1): string {
    const stateMap = this.qTable.get(state);

    if (!stateMap || Math.random() < epsilon) {
      // Explore: random action
      const actions = ['engage_engines', 'adjust_attitude', 'reduce_power', 'maintain_course'];
      return actions[Math.floor(Math.random() * actions.length)];
    }

    // Exploit: best Q-value
    let bestAction = '';
    let bestQ = -Infinity;

    for (const [action, q] of stateMap) {
      if (q > bestQ) {
        bestQ = q;
        bestAction = action;
      }
    }

    return bestAction;
  }
}
