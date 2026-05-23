/**
 * Formation Flying Control Algorithms
 * 
 * Multi-satellite formation control using:
 * - Proportional-Derivative (PD) controllers
 * - Consensus-based algorithms
 * - Lyapunov stability analysis
 * - Collision avoidance
 */

export interface SatelliteState {
  id: string;
  position: Vector3D;
  velocity: Vector3D;
  mass: number;
  maxAcceleration: number;
}

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface FormationControl {
  targetPosition: Vector3D;
  targetVelocity: Vector3D;
  desiredDistance: number; // From reference satellite
  controlForce: Vector3D;
}

/**
 * 3D Vector utilities
 */
export class Vector {
  static add(a: Vector3D, b: Vector3D): Vector3D {
    return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
  }

  static subtract(a: Vector3D, b: Vector3D): Vector3D {
    return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  }

  static multiply(v: Vector3D, scalar: number): Vector3D {
    return { x: v.x * scalar, y: v.y * scalar, z: v.z * scalar };
  }

  static dot(a: Vector3D, b: Vector3D): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  static cross(a: Vector3D, b: Vector3D): Vector3D {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x,
    };
  }

  static magnitude(v: Vector3D): number {
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  }

  static normalize(v: Vector3D): Vector3D {
    const mag = this.magnitude(v);
    if (mag === 0) return { x: 0, y: 0, z: 0 };
    return this.multiply(v, 1 / mag);
  }

  static distance(a: Vector3D, b: Vector3D): number {
    return this.magnitude(this.subtract(a, b));
  }
}

/**
 * PD (Proportional-Derivative) Formation Controller
 * Controls each satellite to maintain desired relative position
 */
export class PDFormationController {
  private kp: number = 0.1; // Proportional gain
  private kd: number = 0.05; // Derivative gain
  private integralError: Record<string, Vector3D> = {};

  /**
   * Compute control force for a satellite
   * Force = Kp * (desired - actual) + Kd * (desired_vel - actual_vel)
   */
  computeControl(
    satellite: SatelliteState,
    referenceSatellite: SatelliteState,
    desiredRelativePosition: Vector3D,
    desiredRelativeVelocity: Vector3D
  ): FormationControl {
    // Calculate current relative state
    const currentRelativePos = Vector.subtract(
      satellite.position,
      referenceSatellite.position
    );
    const currentRelativeVel = Vector.subtract(
      satellite.velocity,
      referenceSatellite.velocity
    );

    // Position error
    const posError = Vector.subtract(desiredRelativePosition, currentRelativePos);

    // Velocity error
    const velError = Vector.subtract(desiredRelativeVelocity, currentRelativeVel);

    // PD control law
    const controlForce = Vector.add(
      Vector.multiply(posError, this.kp),
      Vector.multiply(velError, this.kd)
    );

    // Limit control force
    let controlMagnitude = Vector.magnitude(controlForce);
    const maxForce = satellite.mass * satellite.maxAcceleration;

    if (controlMagnitude > maxForce) {
      return {
        targetPosition: satellite.position,
        targetVelocity: satellite.velocity,
        desiredDistance: Vector.distance(
          satellite.position,
          referenceSatellite.position
        ),
        controlForce: Vector.multiply(
          Vector.normalize(controlForce),
          maxForce
        ),
      };
    }

    return {
      targetPosition: Vector.add(satellite.position, controlForce),
      targetVelocity: Vector.add(satellite.velocity, 
        Vector.multiply(controlForce, 1 / satellite.mass)),
      desiredDistance: Vector.distance(
        satellite.position,
        referenceSatellite.position
      ),
      controlForce,
    };
  }

  /**
   * Update controller gains (adaptive control)
   */
  updateGains(kp: number, kd: number): void {
    this.kp = Math.max(0, kp);
    this.kd = Math.max(0, kd);
  }
}

/**
 * Consensus-Based Formation Control
 * Each satellite reaches consensus with neighbors on desired formation
 */
export class ConsensusFormationController {
  private consensusGain: number = 0.1;
  private consensusStates: Map<string, Vector3D> = new Map();

  /**
   * Update consensus state based on neighbor information
   */
  updateConsensus(
    satelliteId: string,
    neighbors: Array<{ id: string; state: Vector3D }>,
    dt: number
  ): Vector3D {
    let consensusUpdate = { x: 0, y: 0, z: 0 };

    // Weight own state plus neighbor states
    consensusUpdate = { ...this.consensusStates.get(satelliteId) || { x: 0, y: 0, z: 0 } };

    for (const neighbor of neighbors) {
      const neighborState = this.consensusStates.get(neighbor.id) || neighbor.state;
      const diff = Vector.subtract(neighborState, consensusUpdate);
      consensusUpdate = Vector.add(
        consensusUpdate,
        Vector.multiply(diff, this.consensusGain)
      );
    }

    this.consensusStates.set(satelliteId, consensusUpdate);
    return consensusUpdate;
  }

  /**
   * Get current consensus state
   */
  getConsensusState(satelliteId: string): Vector3D {
    return this.consensusStates.get(satelliteId) || { x: 0, y: 0, z: 0 };
  }

  /**
   * Check consensus convergence
   */
  checkConvergence(tolerance: number = 0.01): boolean {
    if (this.consensusStates.size < 2) return true;

    const states = Array.from(this.consensusStates.values());
    const mean = states.reduce(
      (acc, s) => Vector.add(acc, s),
      { x: 0, y: 0, z: 0 }
    );
    const meanState = Vector.multiply(mean, 1 / states.length);

    // Check if all states are within tolerance of mean
    for (const state of states) {
      const distance = Vector.distance(state, meanState);
      if (distance > tolerance) return false;
    }

    return true;
  }
}

/**
 * Collision Avoidance Controller
 * Prevents satellite collisions using repulsive potential fields
 */
export class CollisionAvoidanceController {
  private safetyRadius: number = 100; // meters
  private repulsiveGain: number = 0.01;

  /**
   * Compute repulsive force from nearby satellites
   */
  computeRepulsiveForces(
    satellite: SatelliteState,
    neighbors: SatelliteState[]
  ): Vector3D {
    let totalRepulsiveForce = { x: 0, y: 0, z: 0 };

    for (const neighbor of neighbors) {
      const distance = Vector.distance(satellite.position, neighbor.position);

      // Only consider neighbors within safety radius
      if (distance < this.safetyRadius && distance > 0.1) {
        // Repulsive force magnitude increases as distance decreases
        const repulsiveMagnitude =
          (this.repulsiveGain * (this.safetyRadius - distance)) / distance;

        // Direction: away from neighbor
        const direction = Vector.normalize(
          Vector.subtract(satellite.position, neighbor.position)
        );

        const repulsiveForce = Vector.multiply(direction, repulsiveMagnitude);
        totalRepulsiveForce = Vector.add(totalRepulsiveForce, repulsiveForce);
      }
    }

    return totalRepulsiveForce;
  }

  /**
   * Check for collision risk
   */
  checkCollisionRisk(
    satellites: SatelliteState[]
  ): Array<{
    satellite1: string;
    satellite2: string;
    distance: number;
    riskLevel: number;
  }> {
    const risks = [];
    const criticalRadius = this.safetyRadius * 0.3;

    for (let i = 0; i < satellites.length; i++) {
      for (let j = i + 1; j < satellites.length; j++) {
        const distance = Vector.distance(
          satellites[i].position,
          satellites[j].position
        );

        if (distance < this.safetyRadius) {
          const riskLevel = 1 - distance / this.safetyRadius;
          risks.push({
            satellite1: satellites[i].id,
            satellite2: satellites[j].id,
            distance,
            riskLevel: Math.min(1, riskLevel),
          });
        }
      }
    }

    return risks.sort((a, b) => b.riskLevel - a.riskLevel);
  }
}

/**
 * Lyapunov-based Formation Stability Analyzer
 * Analyzes stability using Lyapunov function
 */
export class LyapunovStabilityAnalyzer {
  /**
   * Compute Lyapunov function value
   * V = sum of squared relative positions
   */
  computeLyapunovFunction(satellites: SatelliteState[], reference: SatelliteState): number {
    let V = 0;

    for (const sat of satellites) {
      if (sat.id === reference.id) continue;

      const relPos = Vector.subtract(sat.position, reference.position);
      V += Vector.dot(relPos, relPos);
    }

    return V;
  }

  /**
   * Compute time derivative of Lyapunov function
   * dV/dt = sum of 2 * position_error · velocity_error
   */
  computeLyapunovDerivative(
    satellites: SatelliteState[],
    reference: SatelliteState,
    desiredFormation: Record<string, Vector3D>
  ): number {
    let dV = 0;

    for (const sat of satellites) {
      if (sat.id === reference.id) continue;

      const relPos = Vector.subtract(sat.position, reference.position);
      const relVel = Vector.subtract(sat.velocity, reference.velocity);
      const desired = desiredFormation[sat.id] || { x: 0, y: 0, z: 0 };
      const error = Vector.subtract(desired, relPos);

      dV += 2 * Vector.dot(error, relVel);
    }

    return dV;
  }

  /**
   * Check if formation is asymptotically stable
   * Stable if V is positive definite and dV/dt is negative definite
   */
  checkStability(
    satellites: SatelliteState[],
    reference: SatelliteState,
    desiredFormation: Record<string, Vector3D>,
    tolerance: number = 0.01
  ): {
    isStable: boolean;
    V: number;
    dV: number;
    convergenceRate: number;
  } {
    const V = this.computeLyapunovFunction(satellites, reference);
    const dV = this.computeLyapunovDerivative(satellites, reference, desiredFormation);

    // Stable if V > 0 and dV < 0 (V is decreasing)
    const isStable = V > tolerance && dV < -tolerance;

    // Convergence rate (how fast error decreases)
    const convergenceRate = dV === 0 ? 0 : -dV / Math.max(V, 1e-6);

    return {
      isStable,
      V,
      dV,
      convergenceRate,
    };
  }
}

/**
 * Formation Shape Definitions
 */
export class FormationShapes {
  /**
   * Linear formation (single line)
   */
  static createLinearFormation(
    satelliteCount: number,
    spacing: number = 100
  ): Record<string, Vector3D> {
    const formation: Record<string, Vector3D> = {};

    for (let i = 0; i < satelliteCount; i++) {
      formation[`SAT-${String(i + 1).padStart(3, "0")}`] = {
        x: i * spacing,
        y: 0,
        z: 0,
      };
    }

    return formation;
  }

  /**
   * Circular formation (orbit around reference)
   */
  static createCircularFormation(
    satelliteCount: number,
    radius: number = 500
  ): Record<string, Vector3D> {
    const formation: Record<string, Vector3D> = {};
    const angleStep = (2 * Math.PI) / satelliteCount;

    for (let i = 0; i < satelliteCount; i++) {
      const angle = i * angleStep;
      formation[`SAT-${String(i + 1).padStart(3, "0")}`] = {
        x: radius * Math.cos(angle),
        y: radius * Math.sin(angle),
        z: 0,
      };
    }

    return formation;
  }

  /**
   * Grid formation (2D grid pattern)
   */
  static createGridFormation(
    rows: number,
    cols: number,
    spacing: number = 100
  ): Record<string, Vector3D> {
    const formation: Record<string, Vector3D> = {};
    let satNum = 1;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        formation[`SAT-${String(satNum).padStart(3, "0")}`] = {
          x: col * spacing,
          y: row * spacing,
          z: 0,
        };
        satNum++;
      }
    }

    return formation;
  }

  /**
   * Tetrahedral formation (3D constellation)
   */
  static createTetrahedralFormation(
    radius: number = 500
  ): Record<string, Vector3D> {
    const phi = (1 + Math.sqrt(5)) / 2; // Golden ratio

    return {
      "SAT-001": { x: 1, y: 1, z: 1 },
      "SAT-002": { x: 1, y: -1, z: -1 },
      "SAT-003": { x: -1, y: 1, z: -1 },
      "SAT-004": { x: -1, y: -1, z: 1 },
    };
  }
}
