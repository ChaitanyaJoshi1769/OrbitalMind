/**
 * Multi-Constellation Federation - Optimized
 *
 * Uses optimization algorithms for:
 * - O(n) best target selection instead of O(n log n) sorting
 * - Single-pass constellation statistics calculation
 * - Efficient handoff request validation
 */

import pino from "pino";
import { PriorityQueue } from "@orbitalmind/optimization-lib";

export interface ConstellationConfig {
  constellationId: string;
  operator: string;
  satelliteCount: number;
  orbitalAltitude: number;
  orbitalInclination: number;
  coverage: number;
  dataRateGbps: number;
  region?: string;
}

export interface ConstellationMember {
  constellationId: string;
  operator: string;
  contactInfo: string;
  publicKey: Buffer;
  trustLevel: number;
  serviceAgreement: ServiceAgreement;
}

export interface ServiceAgreement {
  constellationId: string;
  startDate: number;
  endDate: number;
  resourceAllocation: ResourceAllocation;
  priorityLevel: number;
  slaUptimePercent: number;
}

export interface ResourceAllocation {
  downlinkBandwidth: number;
  uplinkBandwidth: number;
  storageQuota: number;
  computeUnits: number;
}

export interface HandoffRequest {
  requestId: string;
  sourceConstellation: string;
  targetConstellation: string;
  satelliteId: string;
  timestamp: number;
  handoffTime: number;
  dataToTransfer: number;
  priority: number;
}

export interface HandoffResult {
  success: boolean;
  handoffTime: number;
  dataTransferred: number;
  qualityScore: number;
  targetConstellation: string;
}

export interface ConstellationScore {
  constellationId: string;
  score: number;
  coverage: number;
  trust: number;
  resources: boolean;
}

/**
 * Constellation Federation Manager - Optimized
 * Uses priority queue and single-pass algorithms for better performance
 */
export class ConstellationFederationOptimized {
  private members: Map<string, ConstellationMember>;
  private constellations: Map<string, ConstellationConfig>;
  private activeHandoffs: Map<string, HandoffRequest>;
  private completedHandoffs: HandoffResult[];
  private logger = pino();
  private pq: PriorityQueue<ConstellationScore>;

  // Performance metrics
  private metrics = {
    totalSelections: 0,
    avgSelectionTimeMs: 0,
    handoffAttempts: 0,
    handoffSuccesses: 0
  };

  constructor() {
    this.members = new Map();
    this.constellations = new Map();
    this.activeHandoffs = new Map();
    this.completedHandoffs = [];
    this.pq = new PriorityQueue<ConstellationScore>();
  }

  /**
   * Register constellation in federation
   */
  registerConstellation(
    config: ConstellationConfig,
    member: ConstellationMember
  ): boolean {
    if (!config.constellationId || !config.operator) {
      return false;
    }

    this.constellations.set(config.constellationId, config);
    this.members.set(config.constellationId, member);

    this.logger.info(
      { constellationId: config.constellationId, operator: config.operator },
      "Constellation registered in federation"
    );

    return true;
  }

  /**
   * Get constellation member
   */
  getMember(constellationId: string): ConstellationMember | undefined {
    return this.members.get(constellationId);
  }

  /**
   * Verify constellation in good standing
   */
  isInGoodStanding(constellationId: string): boolean {
    const member = this.members.get(constellationId);
    if (!member) return false;

    const now = Date.now();
    const agreement = member.serviceAgreement;

    const isActive = now >= agreement.startDate && now <= agreement.endDate;
    const isTrusted = member.trustLevel > 0.5;

    return isActive && isTrusted;
  }

  /**
   * Request handoff between constellations
   */
  requestHandoff(
    sourceConstellation: string,
    targetConstellation: string,
    satelliteId: string,
    dataToTransfer: number,
    priority: number = 3
  ): { requestId: string; accepted: boolean; reason?: string } {
    this.metrics.handoffAttempts++;

    if (!this.isInGoodStanding(sourceConstellation)) {
      return {
        requestId: "",
        accepted: false,
        reason: "Source constellation not in good standing"
      };
    }

    if (!this.isInGoodStanding(targetConstellation)) {
      return {
        requestId: "",
        accepted: false,
        reason: "Target constellation not in good standing"
      };
    }

    const targetMember = this.members.get(targetConstellation)!;
    if (dataToTransfer > targetMember.serviceAgreement.resourceAllocation.storageQuota) {
      return {
        requestId: "",
        accepted: false,
        reason: "Insufficient storage quota in target constellation"
      };
    }

    const requestId = `handoff-${Date.now()}`;
    const handoffRequest: HandoffRequest = {
      requestId,
      sourceConstellation,
      targetConstellation,
      satelliteId,
      timestamp: Date.now(),
      handoffTime: Date.now() + 300000,
      dataToTransfer,
      priority
    };

    this.activeHandoffs.set(requestId, handoffRequest);
    this.metrics.handoffSuccesses++;

    this.logger.info(
      { requestId, source: sourceConstellation, target: targetConstellation },
      "Handoff request accepted"
    );

    return { requestId, accepted: true };
  }

  /**
   * Complete handoff
   */
  completeHandoff(
    requestId: string,
    dataTransferred: number,
    qualityScore: number = 1.0
  ): HandoffResult | null {
    const request = this.activeHandoffs.get(requestId);
    if (!request) return null;

    const result: HandoffResult = {
      success: true,
      handoffTime: Date.now(),
      dataTransferred,
      qualityScore,
      targetConstellation: request.targetConstellation
    };

    this.activeHandoffs.delete(requestId);
    this.completedHandoffs.push(result);

    const targetMember = this.members.get(request.targetConstellation);
    if (targetMember && qualityScore > 0.9) {
      targetMember.trustLevel = Math.min(1, targetMember.trustLevel + 0.05);
    }

    this.logger.info(
      { requestId, qualityScore, dataTransferred },
      "Handoff completed"
    );

    return result;
  }

  /**
   * Find best target constellation for handoff
   * O(n) single pass with accumulation instead of O(n log n) sorting
   */
  findBestTargetOptimized(
    sourceSatelliteId: string,
    dataToTransfer: number,
    currentLocation: { lat: number; lon: number }
  ): ConstellationConfig | null {
    let bestScore = -1;
    let bestConstellation: ConstellationConfig | null = null;

    const startTime = Date.now();

    // Single pass through all constellations (O(n))
    for (const constellation of this.constellations.values()) {
      if (!this.isInGoodStanding(constellation.constellationId)) {
        continue;
      }

      const member = this.members.get(constellation.constellationId)!;

      // Check resource availability
      const hasResources =
        dataToTransfer <=
        member.serviceAgreement.resourceAllocation.storageQuota;

      if (!hasResources) {
        continue;
      }

      // Calculate composite score
      const coverageScore = constellation.coverage / 100;
      const locationScore = constellation.region === "global" ? 1.0 : 0.8;
      const trustScore = member.trustLevel;
      const slaScore = member.serviceAgreement.priorityLevel / 5;

      const score =
        coverageScore * 0.3 +
        trustScore * 0.3 +
        locationScore * 0.2 +
        slaScore * 0.2;

      // Track best only (O(1) comparison)
      if (score > bestScore) {
        bestScore = score;
        bestConstellation = constellation;
      }
    }

    const selectionTime = Date.now() - startTime;
    this.metrics.totalSelections++;
    this.metrics.avgSelectionTimeMs =
      (this.metrics.avgSelectionTimeMs * (this.metrics.totalSelections - 1) + selectionTime) /
      this.metrics.totalSelections;

    this.logger.info(
      {
        selectedConstellation: bestConstellation?.constellationId,
        score: bestScore.toFixed(2),
        selectionTimeMs: selectionTime
      },
      "Best target constellation selected"
    );

    return bestConstellation;
  }

  /**
   * Get handoff statistics with single-pass calculation
   */
  getHandoffStatistics(): {
    totalRequests: number;
    activeHandoffs: number;
    completedHandoffs: number;
    successRate: number;
    averageDataTransferred: number;
    averageQualityScore: number;
  } {
    const totalRequests = this.activeHandoffs.size + this.completedHandoffs.length;
    const completedCount = this.completedHandoffs.length;

    let successCount = 0;
    let totalDataTransferred = 0;
    let totalQualityScore = 0;

    // Single pass for all statistics (O(n))
    for (const handoff of this.completedHandoffs) {
      if (handoff.success) successCount++;
      totalDataTransferred += handoff.dataTransferred;
      totalQualityScore += handoff.qualityScore;
    }

    const successRate = completedCount > 0 ? successCount / completedCount : 0;
    const averageDataTransferred = completedCount > 0 ? totalDataTransferred / completedCount : 0;
    const averageQualityScore = completedCount > 0 ? totalQualityScore / completedCount : 0;

    return {
      totalRequests,
      activeHandoffs: this.activeHandoffs.size,
      completedHandoffs: completedCount,
      successRate,
      averageDataTransferred,
      averageQualityScore
    };
  }

  /**
   * Get federation status with single-pass calculation
   */
  getFederationStatus(): {
    members: number;
    totalSatellites: number;
    totalCoverage: number;
    averageTrust: number;
    handoffCapacity: number;
  } {
    let totalSatellites = 0;
    let totalCoverage = 0;
    let totalTrust = 0;

    // Single pass through all constellations (O(n))
    for (const constellation of this.constellations.values()) {
      totalSatellites += constellation.satelliteCount;
      totalCoverage += constellation.coverage;
    }

    for (const member of this.members.values()) {
      totalTrust += member.trustLevel;
    }

    const memberCount = this.members.size;
    const averageTrust = memberCount > 0 ? totalTrust / memberCount : 0;
    const avgCoverage = memberCount > 0 ? totalCoverage / memberCount : 0;
    const handoffCapacity = this.activeHandoffs.size + this.completedHandoffs.length;

    return {
      members: memberCount,
      totalSatellites,
      totalCoverage: avgCoverage,
      averageTrust,
      handoffCapacity
    };
  }

  /**
   * Get optimization metrics
   */
  getOptimizationMetrics() {
    const successRate = this.metrics.handoffAttempts > 0
      ? (this.metrics.handoffSuccesses / this.metrics.handoffAttempts * 100)
      : 0;

    return {
      totalSelections: this.metrics.totalSelections,
      avgSelectionTimeMs: this.metrics.avgSelectionTimeMs.toFixed(2),
      handoffAttempts: this.metrics.handoffAttempts,
      handoffSuccesses: this.metrics.handoffSuccesses,
      successRate: successRate.toFixed(1)
    };
  }
}

export default ConstellationFederationOptimized;
