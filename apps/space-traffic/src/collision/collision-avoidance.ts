/**
 * Collision Avoidance System
 *
 * Autonomous spacecraft collision avoidance:
 * - Conjunction assessment (CA)
 * - Probability of collision calculation
 * - Maneuver planning
 * - Coordinated evasion
 * - Debris avoidance
 */

import pino from "pino";

/**
 * Conjunction Assessment Data
 */
export interface ConjunctionAssessment {
  assessmentId: string;
  primarySat: string;
  secondarySat: string;
  timeOfClosestApproach: number; // Unix timestamp
  minimumDistance: number; // km
  primaryPosition: { x: number; y: number; z: number };
  secondaryPosition: { x: number; y: number; z: number };
  primaryVelocity: { x: number; y: number; z: number };
  secondaryVelocity: { x: number; y: number; z: number };
  collisionProbability: number; // 0-1
  riskLevel: "safe" | "caution" | "warning" | "critical";
  uncertaintyError: number; // 1-sigma covariance (km)
  lastUpdate: number;
}

/**
 * Maneuver plan
 */
export interface ManeuverPlan {
  maneuverID: string;
  targetSatellite: string;
  conjunctionId: string;
  maneuverType: "proactive" | "reactive" | "evasive";
  deltaVRequired: { x: number; y: number; z: number }; // m/s
  deltaVMagnitude: number; // m/s
  burnTime: number; // Unix timestamp
  duration: number; // seconds
  fuelRequired: number; // kg
  expectedOutcome: {
    newMinDistance: number; // km after maneuver
    newCollisionProbability: number;
    newRiskLevel: "safe" | "caution" | "warning" | "critical";
  };
  status: "planned" | "approved" | "executing" | "completed" | "aborted";
  createdAt: number;
  executedAt?: number;
}

/**
 * Debris object
 */
export interface DebrisObject {
  debrisId: string;
  type: "satellite" | "rocket_body" | "fragmentation" | "paint_flake" | "unknown";
  estimatedMass: number; // kg
  size: number; // cm
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  hazardRating: number; // 0-100
  lastObserved: number;
  sourceConstellation?: string;
  detectionConfidence: number; // 0-1
}

/**
 * Collision Avoidance Engine
 */
export class CollisionAvoidanceEngine {
  private logger = pino();
  private conjunctions: Map<string, ConjunctionAssessment>;
  private maneuvers: Map<string, ManeuverPlan>;
  private debrisMap: Map<string, DebrisObject>;
  private collisionHistogram: Array<{
    timeOfClosestApproach: number;
    satellites: string[];
    probability: number;
  }> = [];

  // Physical constants
  private readonly RE = 6371; // Earth radius km
  private readonly MU = 398600.4418; // Earth's gravitational parameter
  private readonly COLLISION_THRESHOLD = 0.0001; // 10^-4 probability

  constructor() {
    this.conjunctions = new Map();
    this.maneuvers = new Map();
    this.debrisMap = new Map();
  }

  /**
   * Add or update conjunction assessment
   */
  assessConjunction(
    primarySat: string,
    secondarySat: string,
    timeOfClosestApproach: number,
    primaryPos: { x: number; y: number; z: number },
    secondaryPos: { x: number; y: number; z: number },
    primaryVel: { x: number; y: number; z: number },
    secondaryVel: { x: number; y: number; z: number },
    uncertaintyError: number = 1.0
  ): ConjunctionAssessment {
    const assessmentId = `CA-${primarySat}-${secondarySat}-${Date.now()}`;

    // Calculate minimum distance
    const dx = secondaryPos.x - primaryPos.x;
    const dy = secondaryPos.y - primaryPos.y;
    const dz = secondaryPos.z - primaryPos.z;
    const minimumDistance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // Calculate collision probability (Mahalanobis distance approach)
    const relativeVelocity = {
      x: secondaryVel.x - primaryVel.x,
      y: secondaryVel.y - primaryVel.y,
      z: secondaryVel.z - primaryVel.z,
    };

    const collisionProbability = this.calculateCollisionProbability(
      minimumDistance,
      uncertaintyError,
      relativeVelocity
    );

    // Determine risk level
    let riskLevel: "safe" | "caution" | "warning" | "critical" = "safe";
    if (collisionProbability > 0.001) {
      riskLevel = "critical";
    } else if (collisionProbability > 0.0001) {
      riskLevel = "warning";
    } else if (collisionProbability > 0.00001) {
      riskLevel = "caution";
    }

    const assessment: ConjunctionAssessment = {
      assessmentId,
      primarySat,
      secondarySat,
      timeOfClosestApproach,
      minimumDistance,
      primaryPosition: primaryPos,
      secondaryPosition: secondaryPos,
      primaryVelocity: primaryVel,
      secondaryVelocity: secondaryVel,
      collisionProbability,
      riskLevel,
      uncertaintyError,
      lastUpdate: Date.now(),
    };

    this.conjunctions.set(assessmentId, assessment);

    this.logger.info(
      {
        assessmentId,
        primary: primarySat,
        secondary: secondarySat,
        minDistance: minimumDistance.toFixed(2),
        probability: (collisionProbability * 1000000).toFixed(2),
        riskLevel,
      },
      "Conjunction assessment"
    );

    // Log if above threshold
    if (collisionProbability > this.COLLISION_THRESHOLD) {
      this.collisionHistogram.push({
        timeOfClosestApproach,
        satellites: [primarySat, secondarySat],
        probability: collisionProbability,
      });
    }

    return assessment;
  }

  /**
   * Calculate collision probability using Mahalanobis distance
   */
  private calculateCollisionProbability(
    minimumDistance: number,
    uncertaintyError: number,
    relativeVelocity: { x: number; y: number; z: number }
  ): number {
    // Collision radius (roughly satellite + debris worst case)
    const collisionRadius = 0.01; // 10 meters

    // Mahalanobis distance
    const mahalanobisDistance = Math.max(0, minimumDistance - collisionRadius) / uncertaintyError;

    // Probability calculation (simplified)
    // P(collision) ≈ (radius / sigma) * exp(-(mahalanobis^2)/2)
    const baseProb = (collisionRadius / uncertaintyError) * Math.exp(-((mahalanobisDistance ** 2) / 2));

    // Factor in relative velocity (higher velocity = less time in conjunction area)
    const relVelMag = Math.sqrt(
      relativeVelocity.x ** 2 +
        relativeVelocity.y ** 2 +
        relativeVelocity.z ** 2
    );

    const velocityFactor = Math.max(0.1, 1 / (1 + relVelMag / 10)); // Normalized

    const finalProb = Math.min(1, baseProb * velocityFactor);
    return finalProb;
  }

  /**
   * Plan collision avoidance maneuver
   */
  planManeuver(
    conjunctionId: string,
    targetSatellite: string
  ): ManeuverPlan | null {
    const conjunction = this.conjunctions.get(conjunctionId);
    if (!conjunction) {
      this.logger.warn({ conjunctionId }, "Conjunction not found");
      return null;
    }

    // Determine maneuver type based on risk
    let maneuverType: "proactive" | "reactive" | "evasive" = "proactive";
    if (conjunction.riskLevel === "critical") {
      maneuverType = "evasive";
    } else if (conjunction.riskLevel === "warning") {
      maneuverType = "reactive";
    }

    // Calculate delta-V requirement
    // Simple approach: move perpendicular to conjunction plane
    const timeUntilCA =
      conjunction.timeOfClosestApproach - Date.now();
    const hoursUntilCA = timeUntilCA / 3600000;

    // Delta-V to achieve 1 km separation
    const requiredSeparation = 1.0; // km
    const deltaVRequired = Math.sqrt(2 * requiredSeparation / hoursUntilCA);

    // Determine burn time (1 hour before conjunction)
    const burnTime = conjunction.timeOfClosestApproach - 3600000;

    const deltaVVector = this.calculateOptimalManeuver(conjunction, deltaVRequired);

    // Simulate maneuver outcome
    const newMinDistance = Math.max(
      conjunction.minimumDistance + requiredSeparation * 0.8,
      conjunction.minimumDistance
    );
    const newProbability = this.calculateCollisionProbability(
      newMinDistance,
      conjunction.uncertaintyError,
      {
        x: conjunction.secondaryVelocity.x - conjunction.primaryVelocity.x,
        y: conjunction.secondaryVelocity.y - conjunction.primaryVelocity.y,
        z: conjunction.secondaryVelocity.z - conjunction.primaryVelocity.z,
      }
    );

    let newRiskLevel: "safe" | "caution" | "warning" | "critical" = "safe";
    if (newProbability > 0.001) newRiskLevel = "critical";
    else if (newProbability > 0.0001) newRiskLevel = "warning";
    else if (newProbability > 0.00001) newRiskLevel = "caution";

    const maneuver: ManeuverPlan = {
      maneuverID: `MAN-${targetSatellite}-${Date.now()}`,
      targetSatellite,
      conjunctionId,
      maneuverType,
      deltaVRequired: deltaVVector,
      deltaVMagnitude: deltaVRequired,
      burnTime,
      duration: 60, // 60 seconds burn
      fuelRequired: deltaVRequired * 1000 * 0.05, // Rough estimate
      expectedOutcome: {
        newMinDistance,
        newCollisionProbability: newProbability,
        newRiskLevel,
      },
      status: "planned",
      createdAt: Date.now(),
    };

    this.maneuvers.set(maneuver.maneuverID, maneuver);

    this.logger.info(
      {
        maneuverID: maneuver.maneuverID,
        target: targetSatellite,
        deltaV: deltaVRequired.toFixed(3),
        fuelRequired: maneuver.fuelRequired.toFixed(1),
        newProbability: (newProbability * 1000000).toFixed(2),
      },
      "Maneuver planned"
    );

    return maneuver;
  }

  /**
   * Calculate optimal maneuver direction
   */
  private calculateOptimalManeuver(
    conjunction: ConjunctionAssessment,
    magnitude: number
  ): { x: number; y: number; z: number } {
    // Relative position vector
    const dx = conjunction.secondaryPosition.x - conjunction.primaryPosition.x;
    const dy = conjunction.secondaryPosition.y - conjunction.primaryPosition.y;
    const dz = conjunction.secondaryPosition.z - conjunction.primaryPosition.z;

    // Relative velocity vector
    const vx = conjunction.secondaryVelocity.x - conjunction.primaryVelocity.x;
    const vy = conjunction.secondaryVelocity.y - conjunction.primaryVelocity.y;
    const vz = conjunction.secondaryVelocity.z - conjunction.primaryVelocity.z;

    // Direction perpendicular to relative velocity (outward from conjunction)
    // Cross product: r × v
    const cx = dy * vz - dz * vy;
    const cy = dz * vx - dx * vz;
    const cz = dx * vy - dy * vx;

    const cMag = Math.sqrt(cx * cx + cy * cy + cz * cz);

    if (cMag < 1e-6) {
      // Fallback if vectors are collinear
      return { x: magnitude, y: 0, z: 0 };
    }

    return {
      x: (cx / cMag) * magnitude,
      y: (cy / cMag) * magnitude,
      z: (cz / cMag) * magnitude,
    };
  }

  /**
   * Execute approved maneuver
   */
  executeManeuver(maneuverID: string): boolean {
    const maneuver = this.maneuvers.get(maneuverID);
    if (!maneuver) {
      this.logger.warn({ maneuverID }, "Maneuver not found");
      return false;
    }

    if (maneuver.status !== "approved") {
      this.logger.warn({ maneuverID, status: maneuver.status }, "Maneuver not approved");
      return false;
    }

    maneuver.status = "executing";
    maneuver.executedAt = Date.now();

    this.logger.info(
      { maneuverID, target: maneuver.targetSatellite },
      "Maneuver executing"
    );

    // Simulate execution (in reality, would send to propulsion system)
    setTimeout(() => {
      maneuver.status = "completed";
      this.logger.info({ maneuverID }, "Maneuver completed");
    }, maneuver.duration * 1000);

    return true;
  }

  /**
   * Add debris object
   */
  addDebrisObject(debris: DebrisObject): void {
    this.debrisMap.set(debris.debrisId, debris);

    this.logger.info(
      {
        debrisId: debris.debrisId,
        type: debris.type,
        size: debris.size,
        hazardRating: debris.hazardRating,
      },
      "Debris object added"
    );
  }

  /**
   * Get high-risk debris objects
   */
  getHighRiskDebris(hazardThreshold: number = 50): DebrisObject[] {
    const highRisk: DebrisObject[] = [];

    for (const debris of this.debrisMap.values()) {
      if (debris.hazardRating >= hazardThreshold) {
        highRisk.push(debris);
      }
    }

    return highRisk.sort((a, b) => b.hazardRating - a.hazardRating);
  }

  /**
   * Check satellite against all debris
   */
  checkDebrisConjunctions(
    satelliteId: string,
    satPosition: { x: number; y: number; z: number },
    satVelocity: { x: number; y: number; z: number }
  ): ConjunctionAssessment[] {
    const conjunctions: ConjunctionAssessment[] = [];
    const hazardDebris = this.getHighRiskDebris(30);

    for (const debris of hazardDebris) {
      // Simple conjunction prediction
      const dx = debris.position.x - satPosition.x;
      const dy = debris.position.y - satPosition.y;
      const dz = debris.position.z - satPosition.z;
      const currentDistance = Math.sqrt(dx * dx + dy * dy + dz * dz);

      // Only assess if reasonably close
      if (currentDistance > 1000) continue; // 1000 km threshold

      const timeOfClosestApproach = Date.now() + 300000; // 5 minutes ahead
      const conjunction = this.assessConjunction(
        satelliteId,
        debris.debrisId,
        timeOfClosestApproach,
        satPosition,
        debris.position,
        satVelocity,
        debris.velocity,
        0.5
      ); // Larger uncertainty for debris

      if (conjunction.riskLevel !== "safe") {
        conjunctions.push(conjunction);
      }
    }

    return conjunctions;
  }

  /**
   * Get conjunction statistics
   */
  getStatistics(): {
    totalConjunctions: number;
    criticalConjunctions: number;
    warningConjunctions: number;
    plannedManeuvers: number;
    completedManeuvers: number;
    highRiskDebris: number;
    totalDebris: number;
  } {
    const conjunctionArray = Array.from(this.conjunctions.values());
    const criticalCount = conjunctionArray.filter(
      (c) => c.riskLevel === "critical"
    ).length;
    const warningCount = conjunctionArray.filter(
      (c) => c.riskLevel === "warning"
    ).length;

    const maneuverArray = Array.from(this.maneuvers.values());
    const completedCount = maneuverArray.filter(
      (m) => m.status === "completed"
    ).length;

    const highRiskDebris = this.getHighRiskDebris(50);

    return {
      totalConjunctions: this.conjunctions.size,
      criticalConjunctions: criticalCount,
      warningConjunctions: warningCount,
      plannedManeuvers: this.maneuvers.size,
      completedManeuvers: completedCount,
      highRiskDebris: highRiskDebris.length,
      totalDebris: this.debrisMap.size,
    };
  }

  /**
   * Get conjunction assessment
   */
  getConjunction(assessmentId: string): ConjunctionAssessment | undefined {
    return this.conjunctions.get(assessmentId);
  }

  /**
   * Get maneuver plan
   */
  getManeuver(maneuverID: string): ManeuverPlan | undefined {
    return this.maneuvers.get(maneuverID);
  }

  /**
   * Get all high-risk conjunctions
   */
  getHighRiskConjunctions(): ConjunctionAssessment[] {
    return Array.from(this.conjunctions.values()).filter(
      (c) => c.riskLevel === "critical" || c.riskLevel === "warning"
    );
  }

  /**
   * Get pending maneuvers
   */
  getPendingManeuvers(): ManeuverPlan[] {
    return Array.from(this.maneuvers.values()).filter(
      (m) => m.status === "planned" || m.status === "approved"
    );
  }
}

export default CollisionAvoidanceEngine;
