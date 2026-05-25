/**
 * Autonomous Observer - Optimized
 *
 * Uses optimization algorithms for:
 * - O(n) single-pass best target selection instead of iteration
 * - PriorityQueue for observation queue management
 * - Efficient anomaly tracking and filtering
 */

import pino from "pino";
import { PriorityQueue } from "@orbitalmind/optimization-lib";

/**
 * Science target
 */
export interface ScienceTarget {
  targetId: string;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
  priority: number;
  observationFrequency: "hourly" | "daily" | "weekly" | "on_demand";
  requiredResolution: number;
  spectralBands: string[];
  minCloudCover: number;
  observationCount: number;
  dataCollected: number;
  lastObserved?: number;
}

/**
 * Observation campaign
 */
export interface ObservationCampaign {
  campaignId: string;
  name: string;
  description: string;
  objectives: string[];
  targets: string[];
  startTime: number;
  endTime: number;
  priority: "low" | "medium" | "high" | "critical";
  estimatedDataVolume: number;
  expectedRoi: number;
  status: string;
  progress: number;
  dataCollected: number;
  createdAt: number;
}

/**
 * Observation event
 */
export interface ObservationEvent {
  eventId: string;
  campaignId: string;
  targetId: string;
  satellite: string;
  observationTime: number;
  duration: number;
  cloudCover: number;
  quality: number;
  dataSize: number;
  bands: string[];
  coordinates: { latitude: number; longitude: number };
  anomaliesDetected: string[];
  timestamp: number;
}

/**
 * Detected anomaly
 */
export interface DetectedAnomaly {
  anomalyId: string;
  type: string;
  location: { latitude: number; longitude: number };
  confidence: number;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  detectedAt: number;
  satellite: string;
  followUpObservations: number;
  status: string;
}

/**
 * Autonomous Observer - Optimized
 */
export class AutonomousObserverOptimized {
  private targets: Map<string, ScienceTarget>;
  private campaigns: Map<string, ObservationCampaign>;
  private observations: Map<string, ObservationEvent>;
  private anomalies: Map<string, DetectedAnomaly>;
  private logger = pino();
  private observationPriorityQueue: PriorityQueue<{
    targetId: string;
    priority: number;
  }>;

  // Performance metrics
  private metrics = {
    totalObservations: 0,
    dataCollected: 0,
    anomaliesDetected: 0,
    missionSuccess: 0,
    avgTargetSelectionTimeMs: 0,
    targetSelections: 0,
  };

  constructor() {
    this.targets = new Map();
    this.campaigns = new Map();
    this.observations = new Map();
    this.anomalies = new Map();
    this.observationPriorityQueue = new PriorityQueue();
  }

  /**
   * Register science target
   */
  registerTarget(
    target: Omit<ScienceTarget, "observationCount" | "dataCollected">
  ): ScienceTarget {
    const scienceTarget: ScienceTarget = {
      ...target,
      observationCount: 0,
      dataCollected: 0,
    };

    this.targets.set(target.targetId, scienceTarget);

    this.logger.info(
      {
        targetId: target.targetId,
        name: target.name,
        type: target.type,
        priority: target.priority,
      },
      "Science target registered"
    );

    return scienceTarget;
  }

  /**
   * Create observation campaign with PriorityQueue management
   */
  createCampaign(
    name: string,
    description: string,
    objectives: string[],
    targetIds: string[],
    priority: "low" | "medium" | "high" | "critical" = "medium",
    durationDays: number = 30
  ): ObservationCampaign {
    const campaignId = `CAMP-${Date.now()}`;
    const now = Date.now();

    // Single-pass estimation of data volume
    let estimatedVolume = 0;
    for (const targetId of targetIds) {
      const target = this.targets.get(targetId);
      if (target) {
        estimatedVolume += 10; // Rough: 10GB per target per campaign
      }
    }

    const campaign: ObservationCampaign = {
      campaignId,
      name,
      description,
      objectives,
      targets: targetIds,
      startTime: now,
      endTime: now + durationDays * 86400000,
      priority,
      estimatedDataVolume: estimatedVolume,
      expectedRoi: this.calculateExpectedRoi(targetIds),
      status: "planned",
      progress: 0,
      dataCollected: 0,
      createdAt: now,
    };

    this.campaigns.set(campaignId, campaign);

    // Add targets to priority queue (O(log n) per target)
    for (const targetId of targetIds) {
      const target = this.targets.get(targetId);
      if (target) {
        // Use negative priority for min-heap (higher priority value = higher urgency)
        this.observationPriorityQueue.enqueue(
          { targetId, priority: target.priority },
          -target.priority
        );
      }
    }

    this.logger.info(
      {
        campaignId,
        name,
        targets: targetIds.length,
        priority,
      },
      "Campaign created (priority queue optimized)"
    );

    return campaign;
  }

  /**
   * Calculate expected ROI from targets - single pass
   */
  private calculateExpectedRoi(targetIds: string[]): number {
    let totalRoi = 0;

    for (const targetId of targetIds) {
      const target = this.targets.get(targetId);
      if (target) {
        const frequencyMultiplier: Record<string, number> = {
          hourly: 4,
          daily: 1,
          weekly: 0.2,
          on_demand: 0.1,
        };

        totalRoi += target.priority * frequencyMultiplier[target.observationFrequency];
      }
    }

    return totalRoi / targetIds.length;
  }

  /**
   * Get next observation target with O(n) single-pass selection
   */
  getNextObservationTargetOptimized(
    satellite: string,
    currentPosition: { latitude: number; longitude: number }
  ): string | null {
    if (this.targets.size === 0) {
      return null;
    }

    const startTime = Date.now();

    let bestTarget: string | null = null;
    let bestScore = -Infinity;

    // Single-pass through all targets (O(n))
    for (const target of this.targets.values()) {
      // Calculate visibility score based on distance
      const latDiff = Math.abs(target.latitude - currentPosition.latitude);
      const lonDiff = Math.abs(target.longitude - currentPosition.longitude);
      const distance = Math.sqrt(latDiff ** 2 + lonDiff ** 2);
      const visibilityScore = Math.max(0, 100 - distance);

      // Calculate staleness score
      const timeSinceObservation = target.lastObserved
        ? Date.now() - target.lastObserved
        : Infinity;
      const stalenessScore = Math.min(100, timeSinceObservation / 3600000);

      // Combined score with weighting
      const score =
        target.priority * 0.4 + visibilityScore * 0.3 + stalenessScore * 0.3;

      // Track best (O(1) comparison)
      if (score > bestScore) {
        bestScore = score;
        bestTarget = target.targetId;
      }
    }

    // Update metrics
    const selectionTime = Date.now() - startTime;
    this.metrics.targetSelections++;
    this.metrics.avgTargetSelectionTimeMs =
      (this.metrics.avgTargetSelectionTimeMs * (this.metrics.targetSelections - 1) +
        selectionTime) /
      this.metrics.targetSelections;

    this.logger.info(
      {
        selectedTarget: bestTarget,
        score: bestScore.toFixed(2),
        selectionTimeMs: selectionTime,
      },
      "Best target selected (optimized)"
    );

    return bestTarget;
  }

  /**
   * Record observation
   */
  recordObservation(
    campaignId: string,
    targetId: string,
    satellite: string,
    cloudCover: number,
    quality: number,
    dataSizeMb: number,
    bands: string[],
    coordinates: { latitude: number; longitude: number }
  ): ObservationEvent {
    const eventId = `OBS-${Date.now()}`;
    const target = this.targets.get(targetId);

    if (!target) {
      throw new Error(`Target ${targetId} not found`);
    }

    // Detect anomalies
    const anomaliesDetected = this.detectAnomalies(
      coordinates,
      quality,
      cloudCover,
      bands
    );

    const observation: ObservationEvent = {
      eventId,
      campaignId,
      targetId,
      satellite,
      observationTime: Date.now(),
      duration: Math.ceil(dataSizeMb / 10),
      cloudCover,
      quality,
      dataSize: dataSizeMb,
      bands,
      coordinates,
      anomaliesDetected,
      timestamp: Date.now(),
    };

    this.observations.set(eventId, observation);

    // Update target
    target.lastObserved = Date.now();
    target.observationCount++;
    target.dataCollected += dataSizeMb;

    // Update campaign
    const campaign = this.campaigns.get(campaignId);
    if (campaign) {
      campaign.dataCollected += dataSizeMb / 1024;
      campaign.progress = Math.min(
        100,
        (campaign.dataCollected / campaign.estimatedDataVolume) * 100
      );
    }

    // Update metrics
    this.metrics.totalObservations++;
    this.metrics.dataCollected += dataSizeMb / 1024;
    this.metrics.anomaliesDetected += anomaliesDetected.length;

    this.logger.info(
      {
        eventId,
        target: targetId,
        satellite,
        quality,
        cloudCover,
        anomalies: anomaliesDetected.length,
      },
      "Observation recorded"
    );

    return observation;
  }

  /**
   * Detect anomalies in observations
   */
  private detectAnomalies(
    coordinates: { latitude: number; longitude: number },
    quality: number,
    cloudCover: number,
    bands: string[]
  ): string[] {
    const anomalies: string[] = [];

    // Check for cloud cover anomaly
    if (cloudCover > 80 && bands.includes("THERMAL")) {
      anomalies.push("HIGH_CLOUD_COVER");
    }

    // Check for quality anomaly
    if (quality < 30) {
      anomalies.push("LOW_IMAGE_QUALITY");
    }

    // Check for spectral anomalies
    if (bands.includes("SWIR") && bands.includes("NIR")) {
      if (Math.random() > 0.95) {
        anomalies.push("SPECTRAL_ANOMALY_DETECTED");
      }
    }

    // Create anomaly records for high-severity detections
    if (anomalies.length > 0) {
      const anomalyId = `ANOM-${Date.now()}`;
      const detected: DetectedAnomaly = {
        anomalyId,
        type: anomalies[0],
        location: coordinates,
        confidence: quality / 100,
        severity: anomalies[0] === "SPECTRAL_ANOMALY_DETECTED" ? "high" : "medium",
        description: `Anomaly detected: ${anomalies.join(", ")}`,
        detectedAt: Date.now(),
        satellite: "unknown",
        followUpObservations: 0,
        status: "flagged",
      };

      this.anomalies.set(anomalyId, detected);
    }

    return anomalies;
  }

  /**
   * Get high-priority anomalies - single pass with filtering
   */
  getHighPriorityAnomaliesOptimized(): DetectedAnomaly[] {
    const highPriority: DetectedAnomaly[] = [];

    // Single pass through anomalies
    for (const anomaly of this.anomalies.values()) {
      if (anomaly.severity === "high" || anomaly.severity === "critical") {
        highPriority.push(anomaly);
      }
    }

    // Sort by severity
    const severityRank = { critical: 3, high: 2, medium: 1, low: 0 } as Record<
      string,
      number
    >;
    highPriority.sort(
      (a, b) => severityRank[b.severity] - severityRank[a.severity]
    );

    return highPriority;
  }

  /**
   * Activate campaign
   */
  activateCampaign(campaignId: string): boolean {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      return false;
    }

    campaign.status = "active";
    this.logger.info({ campaignId }, "Campaign activated");

    return true;
  }

  /**
   * Complete campaign
   */
  completeCampaign(campaignId: string): boolean {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      return false;
    }

    campaign.status = "completed";
    campaign.progress = 100;

    this.logger.info(
      {
        campaignId,
        dataCollected: campaign.dataCollected.toFixed(1),
      },
      "Campaign completed"
    );

    return true;
  }

  /**
   * Get campaign status
   */
  getCampaignStatus(campaignId: string): {
    progress: number;
    dataCollected: number;
    observationCount: number;
    anomaliesDetected: number;
  } | null {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      return null;
    }

    // Single-pass count of campaign observations
    let observationCount = 0;
    let anomalyCount = 0;

    for (const observation of this.observations.values()) {
      if (observation.campaignId === campaignId) {
        observationCount++;
        anomalyCount += observation.anomaliesDetected.length;
      }
    }

    return {
      progress: campaign.progress,
      dataCollected: campaign.dataCollected,
      observationCount,
      anomaliesDetected: anomalyCount,
    };
  }

  /**
   * Get optimization metrics
   */
  getOptimizationMetrics() {
    return {
      totalObservations: this.metrics.totalObservations,
      dataCollected: this.metrics.dataCollected.toFixed(1),
      anomaliesDetected: this.metrics.anomaliesDetected,
      avgTargetSelectionTimeMs: this.metrics.avgTargetSelectionTimeMs.toFixed(2),
      targetSelections: this.metrics.targetSelections,
    };
  }
}

export default AutonomousObserverOptimized;
