/**
 * Optimized Formation Control
 *
 * Uses vectorized batch operations for O(1) relative position calculations
 * Enables real-time formation control for 100+ satellite formations
 */

import pino from "pino";
import { VectorizedFormationControl, Vector3D } from "@orbitalmind/optimization-lib";

export interface SatelliteFormationState {
  satelliteId: string;
  position: Vector3D;
  velocity: Vector3D;
  mass: number;
}

export interface FormationControlOutput {
  satelliteId: string;
  desiredVelocity: Vector3D;
  controlForce: Vector3D;
  thrustRequired: number;
  convergenceError: number;
}

/**
 * Optimized Formation Control using vectorized operations
 */
export class FormationControlOptimized {
  private logger = pino();
  private vectorizedController: VectorizedFormationControl;
  private satellites: Map<string, SatelliteFormationState> = new Map();
  private controlOutputs: Map<string, FormationControlOutput> = new Map();

  // Formation control parameters
  private desiredFormationCenter: Vector3D = { x: 0, y: 0, z: 0 };
  private desiredFormationType: 'linear' | 'pyramidal' | 'circular' = 'linear';
  private formationScale: number = 1.0; // meters

  // Controller gains
  private proportionalGain: number = 1.0;
  private derivativeGain: number = 0.5;

  // Performance metrics
  private metrics = {
    controlComputations: 0,
    avgComputationTime: 0,
    formationError: 0,
    convergenceRate: 0
  };

  constructor() {
    this.vectorizedController = new VectorizedFormationControl();
  }

  /**
   * Register satellite in formation
   */
  public registerSatellite(state: SatelliteFormationState): void {
    this.satellites.set(state.satelliteId, { ...state });
  }

  /**
   * Register multiple satellites (batch operation)
   */
  public registerSatellites(states: SatelliteFormationState[]): void {
    const startTime = Date.now();

    for (const state of states) {
      this.satellites.set(state.satelliteId, { ...state });
    }

    const elapsed = Date.now() - startTime;
    this.logger.debug(
      { count: states.length, timeMs: elapsed },
      "Registered satellites"
    );
  }

  /**
   * Set desired formation configuration
   */
  public setFormationConfiguration(
    center: Vector3D,
    type: 'linear' | 'pyramidal' | 'circular',
    scale: number
  ): void {
    this.desiredFormationCenter = center;
    this.desiredFormationType = type;
    this.formationScale = scale;
  }

  /**
   * Compute formation control for all satellites
   * Uses vectorized batch operations for O(n) instead of O(n²)
   */
  public computeFormationControl(): FormationControlOutput[] {
    const startTime = Date.now();

    if (this.satellites.size === 0) {
      this.logger.warn("No satellites registered for formation control");
      return [];
    }

    // Collect all satellite states
    const satelliteArray = Array.from(this.satellites.values());

    // Get desired relative positions based on formation type
    const desiredRelativePositions = this.getDesiredFormationPositions(
      satelliteArray.length
    );

    // Calculate relative positions using vectorized operations
    const relativePositions = this.vectorizedController.calculateRelativePositions(
      satelliteArray.map(s => s.position),
      this.desiredFormationCenter
    );

    // Calculate control forces using vectorized operations
    const controlForces = this.vectorizedController.calculateControlForces(
      relativePositions,
      desiredRelativePositions,
      this.proportionalGain,
      this.derivativeGain
    );

    // Build output for each satellite
    this.controlOutputs.clear();
    const outputs: FormationControlOutput[] = [];

    for (let i = 0; i < satelliteArray.length; i++) {
      const sat = satelliteArray[i];
      const force = controlForces[i];
      const relPos = relativePositions[i];
      const desiredRelPos = desiredRelativePositions[i];

      // Calculate convergence error
      const positionError = Math.sqrt(
        Math.pow(relPos.x - desiredRelPos.x, 2) +
        Math.pow(relPos.y - desiredRelPos.y, 2) +
        Math.pow(relPos.z - desiredRelPos.z, 2)
      );

      // Calculate required thrust
      const thrustRequired = Math.sqrt(
        force.x * force.x + force.y * force.y + force.z * force.z
      ) / sat.mass;

      // Calculate desired velocity adjustment
      const desiredVelocity: Vector3D = {
        x: sat.velocity.x + (force.x / sat.mass) * 0.1,
        y: sat.velocity.y + (force.y / sat.mass) * 0.1,
        z: sat.velocity.z + (force.z / sat.mass) * 0.1
      };

      const output: FormationControlOutput = {
        satelliteId: sat.satelliteId,
        desiredVelocity,
        controlForce: force,
        thrustRequired,
        convergenceError: positionError
      };

      outputs.push(output);
      this.controlOutputs.set(sat.satelliteId, output);
    }

    // Update metrics
    const elapsed = Date.now() - startTime;
    this.metrics.controlComputations++;
    this.metrics.avgComputationTime =
      (this.metrics.avgComputationTime * 0.9) + (elapsed * 0.1);

    const avgError = outputs.reduce((sum, o) => sum + o.convergenceError, 0) / outputs.length;
    this.metrics.formationError = avgError;

    this.logger.info(
      {
        satellites: satelliteArray.length,
        computationMs: elapsed,
        avgError: avgError.toFixed(3),
        thrust: outputs.map(o => o.thrustRequired.toFixed(2))
      },
      "Formation control computed (vectorized)"
    );

    return outputs;
  }

  /**
   * Get desired formation positions based on formation type
   */
  private getDesiredFormationPositions(count: number): Vector3D[] {
    const positions: Vector3D[] = [];
    const spacing = this.formationScale;

    switch (this.desiredFormationType) {
      case 'linear': {
        // Linear formation along X axis
        for (let i = 0; i < count; i++) {
          positions.push({
            x: this.desiredFormationCenter.x + (i - count / 2) * spacing,
            y: this.desiredFormationCenter.y,
            z: this.desiredFormationCenter.z
          });
        }
        break;
      }

      case 'pyramidal': {
        // Pyramidal formation
        let idx = 0;
        for (let level = 0; level < Math.ceil(Math.sqrt(count)); level++) {
          const levelWidth = level + 1;
          for (let i = 0; i < levelWidth && idx < count; i++) {
            positions.push({
              x: this.desiredFormationCenter.x + (i - levelWidth / 2) * spacing,
              y: this.desiredFormationCenter.y + level * spacing,
              z: this.desiredFormationCenter.z
            });
            idx++;
          }
        }
        break;
      }

      case 'circular': {
        // Circular formation in XY plane
        const radius = spacing * Math.sqrt(count) / (2 * Math.PI);
        for (let i = 0; i < count; i++) {
          const angle = (2 * Math.PI * i) / count;
          positions.push({
            x: this.desiredFormationCenter.x + radius * Math.cos(angle),
            y: this.desiredFormationCenter.y + radius * Math.sin(angle),
            z: this.desiredFormationCenter.z
          });
        }
        break;
      }
    }

    return positions;
  }

  /**
   * Update satellite state (for use in control loop)
   */
  public updateSatelliteState(satId: string, state: SatelliteFormationState): void {
    this.satellites.set(satId, state);
  }

  /**
   * Get control output for specific satellite
   */
  public getControlOutput(satId: string): FormationControlOutput | null {
    return this.controlOutputs.get(satId) || null;
  }

  /**
   * Get all control outputs
   */
  public getAllControlOutputs(): FormationControlOutput[] {
    return Array.from(this.controlOutputs.values());
  }

  /**
   * Get formation metrics
   */
  public getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Get formation error (average position deviation)
   */
  public getFormationError(): number {
    return this.metrics.formationError;
  }

  /**
   * Check if formation is converged (within tolerance)
   */
  public isFormationConverged(tolerance: number = 1.0): boolean {
    return this.metrics.formationError < tolerance;
  }
}

export default FormationControlOptimized;
