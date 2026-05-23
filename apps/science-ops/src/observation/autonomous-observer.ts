/**
 * Autonomous Science Observer
 *
 * Self-directed satellite observation campaigns:
 * - Target detection and tracking
 * - Observation scheduling
 * - Data collection and analysis
 * - Science goal optimization
 * - Real-time anomaly detection
 */

import pino from "pino";

/**
 * Science target
 */
export interface ScienceTarget {
  targetId: string;
  name: string;
  type: "land_feature" | "atmospheric" | "ocean" | "ice" | "anomaly" | "custom";
  latitude: number;
  longitude: number;
  priority: number; // 0-100
  observationFrequency: "hourly" | "daily" | "weekly" | "on_demand";
  requiredResolution: number; // meters
  spectralBands: string[]; // e.g., ["R", "G", "B", "NIR", "SWIR"]
  minCloudCover: number; // Maximum acceptable cloud cover %
  lastObserved?: number;
  observationCount: number;
  dataCollected: number; // MB
}

/**
 * Observation campaign
 */
export interface ObservationCampaign {
  campaignId: string;
  name: string;
  description: string;
  objectives: string[];
  targets: string[]; // Target IDs
  startTime: number;
  endTime: number;
  priority: "low" | "medium" | "high" | "critical";
  estimatedDataVolume: number; // GB
  expectedRoi: number; // Return on investment, quality score
  status: "planned" | "active" | "completed" | "paused";
  progress: number; // 0-100
  dataCollected: number; // GB
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
  duration: number; // seconds
  cloudCover: number; // 0-100
  quality: number; // 0-100
  dataSize: number; // MB
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
  type: string; // "thermal", "spectral", "geometric", etc.
  location: { latitude: number; longitude: number };
  confidence: number; // 0-1
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  detectedAt: number;
  satellite: string;
  associatedTarget?: string;
  followUpObservations: number;
  status: "flagged" | "investigating" | "confirmed" | "resolved";
}

/**
 * Autonomous Observer Engine
 */
export class AutonomousObserver {
  private logger = pino();
  private targets: Map<string, ScienceTarget>;
  private campaigns: Map<string, ObservationCampaign>;
  private observations: Map<string, ObservationEvent>;
  private anomalies: Map<string, DetectedAnomaly>;
  private observationQueue: Array<{
    targetId: string;
    priority: number;
    scheduledTime: number;
  }> = [];

  // Performance metrics
  private observationMetrics: {
    totalObservations: number;
    dataCollected: number; // GB
    anomaliesDetected: number;
    missionSuccess: number; // %
    lastUpdate: number;
  } = {
    totalObservations: 0,
    dataCollected: 0,
    anomaliesDetected: 0,
    missionSuccess: 0,
    lastUpdate: Date.now(),
  };

  constructor() {
    this.targets = new Map();
    this.campaigns = new Map();
    this.observations = new Map();
    this.anomalies = new Map();
  }

  /**
   * Register science target
   */
  registerTarget(target: Omit<ScienceTarget, "observationCount" | "dataCollected">): ScienceTarget {
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
   * Create observation campaign
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

    // Estimate data volume from targets
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

    // Add targets to observation queue
    for (const targetId of targetIds) {
      const target = this.targets.get(targetId);
      if (target) {
        this.observationQueue.push({
          targetId,
          priority: target.priority,
          scheduledTime: now,
        });
      }
    }

    this.observationQueue.sort((a, b) => b.priority - a.priority);

    this.logger.info(
      {
        campaignId,
        name,
        targets: targetIds.length,
        priority,
      },
      "Campaign created"
    );

    return campaign;
  }

  /**
   * Calculate expected ROI from targets
   */
  private calculateExpectedRoi(targetIds: string[]): number {
    let totalRoi = 0;

    for (const targetId of targetIds) {
      const target = this.targets.get(targetId);
      if (target) {
        // ROI based on priority and observation frequency
        const frequencyMultiplier = {
          hourly: 4,
          daily: 1,
          weekly: 0.2,
          on_demand: 0.1,
        } as Record<string, number>;

        totalRoi += target.priority * frequencyMultiplier[target.observationFrequency];
      }
    }

    return totalRoi / targetIds.length;
  }

  /**
   * Get next observation target
   */
  getNextObservationTarget(satellite: string, currentPosition: { latitude: number; longitude: number }): string | null {
    if (this.observationQueue.length === 0) {
      return null;
    }

    // Find best target considering:
    // 1. Priority
    // 2. Visibility (geographic location)
    // 3. Time since last observation

    let bestTarget: string | null = null;
    let bestScore = -Infinity;

    for (const item of this.observationQueue) {
      const target = this.targets.get(item.targetId);
      if (!target) continue;

      // Calculate visibility score (simplified)
      const latDiff = Math.abs(target.latitude - currentPosition.latitude);
      const lonDiff = Math.abs(target.longitude - currentPosition.longitude);
      const distance = Math.sqrt(latDiff ** 2 + lonDiff ** 2);
      const visibilityScore = Math.max(0, 100 - distance);

      // Calculate staleness score
      const timeSinceObservation = target.lastObserved
        ? Date.now() - target.lastObserved
        : Infinity;
      const stalenessScore = Math.min(100, timeSinceObservation / 3600000); // Hours

      // Combined score
      const score =
        target.priority * 0.4 +
        visibilityScore * 0.3 +
        stalenessScore * 0.3;

      if (score > bestScore) {
        bestScore = score;
        bestTarget = item.targetId;
      }
    }

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

    // Detect anomalies in observation
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
      duration: Math.ceil(dataSizeMb / 10), // Rough estimate
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
      campaign.dataCollected += dataSizeMb / 1024; // Convert to GB
      campaign.progress = Math.min(
        100,
        (campaign.dataCollected / campaign.estimatedDataVolume) * 100
      );
    }

    // Update metrics
    this.observationMetrics.totalObservations++;
    this.observationMetrics.dataCollected += dataSizeMb / 1024; // GB
    this.observationMetrics.anomaliesDetected += anomaliesDetected.length;
    this.observationMetrics.lastUpdate = Date.now();

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

    // Check for spectral anomalies (simplified)
    if (bands.includes("SWIR") && bands.includes("NIR")) {
      // Simulate spectral anomaly detection
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
        severity:
          anomalies[0] === "SPECTRAL_ANOMALY_DETECTED" ? "high" : "medium",
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
   * Pause campaign
   */
  pauseCampaign(campaignId: string): boolean {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      return false;
    }

    campaign.status = "paused";
    this.logger.info({ campaignId }, "Campaign paused");

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

    const campaignObservations = Array.from(this.observations.values()).filter(
      (o) => o.campaignId === campaignId
    );

    return {
      progress: campaign.progress,
      dataCollected: campaign.dataCollected,
      observationCount: campaignObservations.length,
      anomaliesDetected: Array.from(this.anomalies.values()).filter(
        (a) =>
          campaignObservations.some(
            (o) => o.anomaliesDetected.length > 0
          )
      ).length,
    };
  }

  /**
   * Get high-priority anomalies
   */
  getHighPriorityAnomalies(): DetectedAnomaly[] {
    return Array.from(this.anomalies.values())
      .filter((a) => a.severity === "high" || a.severity === "critical")
      .sort((a, b) => {
        const severityRank = {
          critical: 3,
          high: 2,
          medium: 1,
          low: 0,
        } as Record<string, number>;
        return severityRank[b.severity] - severityRank[a.severity];
      });
  }

  /**
   * Flag anomaly for follow-up
   */
  flagAnomalyForFollowUp(anomalyId: string): boolean {
    const anomaly = this.anomalies.get(anomalyId);
    if (!anomaly) {
      return false;
    }

    anomaly.followUpObservations++;
    anomaly.status = "investigating";

    // Create new target for follow-up observation
    const followUpTarget: ScienceTarget = {
      targetId: `FOLLOWUP-${anomalyId}`,
      name: `Follow-up: ${anomaly.type}`,
      type: "anomaly",
      latitude: anomaly.location.latitude,
      longitude: anomaly.location.longitude,
      priority: 90, // High priority
      observationFrequency: "on_demand",
      requiredResolution: 10, // Higher resolution for anomaly
      spectralBands: ["R", "G", "B", "NIR", "SWIR", "THERMAL"],
      minCloudCover: 20,
      observationCount: 0,
      dataCollected: 0,
    };

    this.registerTarget(followUpTarget);

    this.logger.info(
      { anomalyId, type: anomaly.type },
      "Anomaly flagged for follow-up"
    );

    return true;
  }

  /**
   * Get science metrics
   */
  getScientificMetrics(): {
    totalTargets: number;
    activeCampaigns: number;
    completedCampaigns: number;
    totalObservations: number;
    dataCollected: number;
    anomaliesDetected: number;
    averageQuality: number;
    missionSuccess: number;
  } {
    const campaigns = Array.from(this.campaigns.values());
    const activeCampaigns = campaigns.filter((c) => c.status === "active").length;
    const completedCampaigns = campaigns.filter((c) => c.status === "completed")
      .length;

    const observations = Array.from(this.observations.values());
    const avgQuality =
      observations.length > 0
        ? observations.reduce((sum, o) => sum + o.quality, 0) / observations.length
        : 0;

    // Calculate mission success based on data quality and coverage
    const missionSuccess =
      (avgQuality * 0.5 +
        Math.min(100, (this.observationMetrics.totalObservations / 100) * 10) * 0.3 +
        Math.min(100, (this.observationMetrics.dataCollected / 50) * 10) * 0.2) *
      0.01;

    return {
      totalTargets: this.targets.size,
      activeCampaigns,
      completedCampaigns,
      totalObservations: this.observationMetrics.totalObservations,
      dataCollected: Math.round(this.observationMetrics.dataCollected * 100) / 100,
      anomaliesDetected: this.observationMetrics.anomaliesDetected,
      averageQuality: Math.round(avgQuality * 100) / 100,
      missionSuccess: Math.round(missionSuccess * 100) / 100,
    };
  }

  /**
   * Get target
   */
  getTarget(targetId: string): ScienceTarget | undefined {
    return this.targets.get(targetId);
  }

  /**
   * Get campaign
   */
  getCampaign(campaignId: string): ObservationCampaign | undefined {
    return this.campaigns.get(campaignId);
  }

  /**
   * Get all active campaigns
   */
  getActiveCampaigns(): ObservationCampaign[] {
    return Array.from(this.campaigns.values()).filter((c) => c.status === "active");
  }
}

export default AutonomousObserver;
