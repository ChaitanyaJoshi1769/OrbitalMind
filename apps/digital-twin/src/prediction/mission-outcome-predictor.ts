/**
 * Mission Outcome Prediction Engine
 *
 * Predicts success rates and outcomes for proposed missions:
 * - Coverage analysis
 * - Power budget validation
 * - Communication link feasibility
 * - Thermal constraints
 * - Collision probability
 * - Science data collection potential
 */

import pino from "pino";
import { ConstellationSimulator, SatelliteState, InterSatelliteLink } from "../simulation/constellation-simulator";

/**
 * Ground station visibility result
 */
export interface VisibilityResult {
  stationId: string;
  satelliteId: string;
  visibilityWindow: {
    startTime: number;
    endTime: number;
    maxElevation: number;
    durationMinutes: number;
  };
  contactQuality: number; // 0-1
}

/**
 * Coverage analysis result
 */
export interface CoverageAnalysis {
  region: string;
  latitude: number;
  longitude: number;
  coveragePercent: number; // 0-100
  satelliteCount: number;
  maxRevisitTimeMinutes: number;
  qualityScore: number; // 0-1
}

/**
 * Power budget analysis
 */
export interface PowerBudget {
  satelliteId: string;
  averageGenerationW: number;
  averageConsumptionW: number;
  surplusDeficitW: number;
  batteryDepletionDays: number;
  isSustainable: boolean;
  safetyMargin: number;
}

/**
 * Mission feasibility assessment
 */
export interface MissionFeasibility {
  missionId: string;
  coverageScore: number; // 0-1
  powerScore: number; // 0-1
  communicationScore: number; // 0-1
  thermalScore: number; // 0-1
  collisionScore: number; // 0-1 (higher = safer)
  overallScore: number; // 0-1
  isFeasible: boolean;
  constraints: string[];
  recommendations: string[];
  detailedAnalysis: {
    coverage: CoverageAnalysis[];
    power: PowerBudget[];
    thermalStatus: {
      satelliteId: string;
      avgTemp: number;
      maxTemp: number;
      isSafe: boolean;
    }[];
    collisionRisk: {
      probability: number;
      timeToClosestApproach: number;
    };
  };
}

/**
 * Science data collection prediction
 */
export interface ScienceData {
  targetId: string;
  expectedDataGb: number;
  collectionEfficiency: number; // 0-1
  revisitFrequency: number; // days
  dataDownlinkCapacity: number; // Mbps average
  estimatedDownlinkDays: number;
  qualityScore: number; // 0-1
}

/**
 * Mission Outcome Predictor
 */
export class MissionOutcomePredictor {
  private logger = pino();
  private simulator: ConstellationSimulator;

  constructor() {
    this.simulator = new ConstellationSimulator();
  }

  /**
   * Set simulator for prediction
   */
  setSimulator(simulator: ConstellationSimulator): void {
    this.simulator = simulator;
  }

  /**
   * Predict constellation coverage over time
   */
  predictCoverage(
    latitude: number,
    longitude: number,
    hoursToAnalyze: number = 24,
    minElevation: number = 10
  ): {
    coveragePercent: number;
    revisitTimes: number[];
    maxGapMinutes: number;
    satellites: string[];
  } {
    const coverageWindow = hoursToAnalyze * 3600;
    let coverageTime = 0;
    let lastContactEnd = 0;
    const gaps: number[] = [];
    const contactingSats = new Set<string>();

    // Simulate hour by hour
    for (let t = 0; t < coverageWindow; t += 300) {
      // 5-minute steps
      const prediction = this.simulator.predictState(t);

      for (const sat of prediction.satellites) {
        // Simple elevation calculation
        const elevation = this.calculateElevation(
          sat.position,
          latitude,
          longitude
        );

        if (elevation > minElevation) {
          coverageTime += 300; // 5 minutes
          contactingSats.add(sat.satelliteId);

          if (lastContactEnd > 0) {
            gaps.push(t - lastContactEnd);
          }
          lastContactEnd = t + 300;
        }
      }
    }

    const coveragePercent = (coverageTime / coverageWindow) * 100;
    const maxGap = gaps.length > 0 ? Math.max(...gaps) / 60 : coverageWindow / 60;

    return {
      coveragePercent: Math.min(100, coveragePercent),
      revisitTimes: gaps.map((g) => g / 60),
      maxGapMinutes: maxGap,
      satellites: Array.from(contactingSats),
    };
  }

  /**
   * Calculate elevation angle from ground station to satellite
   */
  private calculateElevation(
    satPosition: { x: number; y: number; z: number },
    latitude: number,
    longitude: number
  ): number {
    // Simplified: assume station at 0m altitude
    const RE = 6371; // Earth radius km
    const lat_rad = (latitude * Math.PI) / 180;
    const lon_rad = (longitude * Math.PI) / 180;

    // Ground station position
    const gs_x = RE * Math.cos(lat_rad) * Math.cos(lon_rad);
    const gs_y = RE * Math.cos(lat_rad) * Math.sin(lon_rad);
    const gs_z = RE * Math.sin(lat_rad);

    // Vector from ground station to satellite
    const dx = satPosition.x - gs_x;
    const dy = satPosition.y - gs_y;
    const dz = satPosition.z - gs_z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // Local zenith at ground station
    const zenith_x = gs_x / RE;
    const zenith_y = gs_y / RE;
    const zenith_z = gs_z / RE;

    // Dot product to get elevation
    const dot = dx * zenith_x + dy * zenith_y + dz * zenith_z;
    const zenith_angle = Math.acos(dot / distance);
    const elevation = 90 - (zenith_angle * 180) / Math.PI;

    return Math.max(-90, Math.min(90, elevation));
  }

  /**
   * Analyze power sustainability
   */
  analyzePowerBudget(hoursToAnalyze: number = 24): PowerBudget[] {
    const budgets: PowerBudget[] = [];
    const timesteps = (hoursToAnalyze * 3600) / 600; // 10-minute steps

    for (const sat of this.simulator.getSatellites()) {
      let totalGeneration = 0;
      let totalConsumption = 0;
      let minBattery = 100;

      for (let t = 0; t < hoursToAnalyze * 3600; t += 600) {
        const prediction = this.simulator.predictState(t);
        const predSat = prediction.satellites.find(
          (s) => s.satelliteId === sat.satelliteId
        );

        if (predSat) {
          totalGeneration += predSat.powerGenerationW;
          totalConsumption += predSat.powerConsumptionW;
          minBattery = Math.min(minBattery, predSat.batteryPercent);
        }
      }

      const avgGeneration = totalGeneration / timesteps;
      const avgConsumption = totalConsumption / timesteps;
      const surplus = avgGeneration - avgConsumption;

      // Time to deplete at current deficit rate
      let depletionDays = Infinity;
      if (surplus < 0) {
        const batteryCapacityWh = 1000;
        const currentBattery = (minBattery / 100) * batteryCapacityWh;
        depletionDays = currentBattery / Math.abs(surplus) / 24;
      }

      budgets.push({
        satelliteId: sat.satelliteId,
        averageGenerationW: avgGeneration,
        averageConsumptionW: avgConsumption,
        surplusDeficitW: surplus,
        batteryDepletionDays: depletionDays,
        isSustainable: surplus > 0 || minBattery > 20,
        safetyMargin: surplus / avgConsumption,
      });
    }

    return budgets;
  }

  /**
   * Check thermal constraints
   */
  checkThermalConstraints(
    maxTemp: number = 75,
    minTemp: number = -50
  ): {
    satelliteId: string;
    avgTemp: number;
    maxTemp: number;
    minTemp: number;
    isSafe: boolean;
  }[] {
    const thermalStatus = [];

    for (const sat of this.simulator.getSatellites()) {
      let tempSum = 0;
      let tempMax = -Infinity;
      let tempMin = Infinity;
      let count = 0;

      // Sample 24 hours
      for (let t = 0; t < 86400; t += 3600) {
        const prediction = this.simulator.predictState(t);
        const predSat = prediction.satellites.find(
          (s) => s.satelliteId === sat.satelliteId
        );

        if (predSat) {
          tempSum += predSat.temperature;
          tempMax = Math.max(tempMax, predSat.temperature);
          tempMin = Math.min(tempMin, predSat.temperature);
          count++;
        }
      }

      const avgTemp = tempSum / count;
      const isSafe = tempMax <= maxTemp && tempMin >= minTemp;

      thermalStatus.push({
        satelliteId: sat.satelliteId,
        avgTemp,
        maxTemp,
        minTemp,
        isSafe,
      });
    }

    return thermalStatus;
  }

  /**
   * Predict collision probability
   */
  predictCollisionProbability(daysToAnalyze: number = 7): {
    probability: number;
    eventCount: number;
    riskLevel: "critical" | "high" | "medium" | "low";
  } {
    let collisionEvents = 0;
    const timeSteps = (daysToAnalyze * 86400) / 3600; // Hourly steps
    const minDistance = 0.1; // 100 meters

    for (let t = 0; t < daysToAnalyze * 86400; t += 3600) {
      const prediction = this.simulator.predictState(t);
      const collisions = prediction.satellites.length > 1
        ? this.simulator.checkCollisions(minDistance)
        : [];

      collisionEvents += collisions.filter((c) => c.riskLevel !== "safe").length;
    }

    const probability = collisionEvents / timeSteps;
    let riskLevel: "critical" | "high" | "medium" | "low" = "low";

    if (probability > 0.01) riskLevel = "critical";
    else if (probability > 0.001) riskLevel = "high";
    else if (probability > 0.0001) riskLevel = "medium";

    return {
      probability,
      eventCount: collisionEvents,
      riskLevel,
    };
  }

  /**
   * Comprehensive mission feasibility analysis
   */
  analyzeMissionFeasibility(missionId: string, targetLatitude: number, targetLongitude: number): MissionFeasibility {
    const coverage = this.predictCoverage(targetLatitude, targetLongitude, 24);
    const power = this.analyzePowerBudget(24);
    const thermal = this.checkThermalConstraints();
    const collision = this.predictCollisionProbability(7);

    const constraints: string[] = [];
    const recommendations: string[] = [];

    // Coverage score
    const coverageScore = coverage.coveragePercent / 100;
    if (coverageScore < 0.5) {
      constraints.push("Coverage below 50%");
      recommendations.push("Increase constellation size or inclination");
    }

    // Power score
    const powerIssues = power.filter((p) => !p.isSustainable).length;
    const powerScore = 1 - powerIssues / power.length;
    if (powerScore < 0.8) {
      constraints.push("Satellite power budget unsustainable");
      recommendations.push("Reduce power consumption or add solar panels");
    }

    // Communication score
    const links = this.simulator.calculateISLs();
    const communicationScore = Math.min(1, links.length / (power.length * 2)); // Expected ~2 links per sat
    if (communicationScore < 0.6) {
      constraints.push("ISL network insufficient");
      recommendations.push("Improve satellite spacing or add repeaters");
    }

    // Thermal score
    const thermalIssues = thermal.filter((t) => !t.isSafe).length;
    const thermalScore = 1 - thermalIssues / thermal.length;
    if (thermalScore < 0.8) {
      constraints.push("Thermal constraints violated");
      recommendations.push("Improve radiator efficiency or reduce internal dissipation");
    }

    // Collision score
    const collisionScore = 1 - Math.min(1, collision.probability * 1000);
    if (collisionScore < 0.9) {
      constraints.push(`Collision probability: ${(collision.probability * 100).toFixed(2)}%`);
      recommendations.push("Adjust orbital parameters or implement collision avoidance");
    }

    const overallScore = (coverageScore + powerScore + communicationScore + thermalScore + collisionScore) / 5;
    const isFeasible = overallScore > 0.7 && constraints.length === 0;

    return {
      missionId,
      coverageScore,
      powerScore,
      communicationScore,
      thermalScore,
      collisionScore,
      overallScore,
      isFeasible,
      constraints,
      recommendations,
      detailedAnalysis: {
        coverage: [
          {
            region: `Lat ${targetLatitude}, Lon ${targetLongitude}`,
            latitude: targetLatitude,
            longitude: targetLongitude,
            coveragePercent: coverage.coveragePercent,
            satelliteCount: coverage.satellites.length,
            maxRevisitTimeMinutes: coverage.maxGapMinutes,
            qualityScore: coverageScore,
          },
        ],
        power,
        thermalStatus: thermal,
        collisionRisk: collision,
      },
    };
  }

  /**
   * Predict science data collection capability
   */
  predictScienceDataCollection(targetId: string, durationDays: number = 30): ScienceData {
    const coverage = this.predictCoverage(0, 0, durationDays * 24);
    const links = this.simulator.calculateISLs();

    // Average downlink capacity
    const avgDataRate =
      links.length > 0
        ? links.reduce((sum, l) => sum + l.dataRateMbps, 0) / links.length
        : 10;

    const dataGenerationRate = 50; // Mbps from instruments
    const collectionEfficiency = Math.min(1, avgDataRate / dataGenerationRate);
    const revisitFrequency = coverage.revisitTimes.length > 0
      ? coverage.revisitTimes.reduce((a, b) => a + b, 0) / coverage.revisitTimes.length / 1440
      : 1; // days

    const dailyDataGb = (dataGenerationRate * 86400 * 1e-6) * collectionEfficiency;
    const totalDataGb = dailyDataGb * durationDays;
    const downlinkCapacityGbPerDay = (avgDataRate * 86400 * 1e-6);
    const estimatedDownlinkDays =
      downlinkCapacityGbPerDay > 0
        ? Math.ceil(totalDataGb / downlinkCapacityGbPerDay)
        : durationDays;

    return {
      targetId,
      expectedDataGb: totalDataGb,
      collectionEfficiency,
      revisitFrequency,
      dataDownlinkCapacity: avgDataRate,
      estimatedDownlinkDays,
      qualityScore: (collectionEfficiency * 0.5) + (Math.min(1, avgDataRate / 50) * 0.5),
    };
  }
}

export default MissionOutcomePredictor;
