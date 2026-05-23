/**
 * Autonomous Science Operations Service
 *
 * End-to-end autonomous science operations:
 * - Self-directed observation campaigns
 * - Real-time data analysis
 * - Anomaly detection and follow-up
 * - Dynamic mission adaptation
 */

import express, { Express, Request, Response } from "express";
import pino from "pino";
import { randomUUID } from "crypto";

import AutonomousObserver from "./observation/autonomous-observer";
import ScienceDataAnalyzer from "./analysis/data-analyzer";

/**
 * Science Operations Service
 */
export class ScienceOpsService {
  private app: Express;
  private logger = pino();
  private observer: AutonomousObserver;
  private analyzer: ScienceDataAnalyzer;
  private serviceId: string;

  constructor(private port: number = 3010) {
    this.app = express();
    this.serviceId = randomUUID();
    this.observer = new AutonomousObserver();
    this.analyzer = new ScienceDataAnalyzer();

    this.setupMiddleware();
    this.setupRoutes();
    this.initializeSampleData();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    this.app.use(express.json({ limit: "50mb" }));
    this.app.use((req, res, next) => {
      req.id = randomUUID();
      this.logger.info(
        { method: req.method, path: req.path, requestId: req.id },
        "Incoming request"
      );
      next();
    });
  }

  /**
   * Initialize with sample data
   */
  private initializeSampleData(): void {
    // Register science targets
    const targets = [
      {
        targetId: "TARGET-AMAZON",
        name: "Amazon Rainforest",
        type: "land_feature" as const,
        latitude: -3,
        longitude: -60,
        priority: 85,
        observationFrequency: "weekly" as const,
        requiredResolution: 30,
        spectralBands: ["R", "G", "B", "NIR", "SWIR"],
        minCloudCover: 30,
      },
      {
        targetId: "TARGET-GLACIER",
        name: "Glacier Monitoring",
        type: "ice" as const,
        latitude: 46.8,
        longitude: 10.5,
        priority: 80,
        observationFrequency: "monthly" as const,
        requiredResolution: 15,
        spectralBands: ["B", "G", "SWIR"],
        minCloudCover: 20,
      },
      {
        targetId: "TARGET-OCEAN",
        name: "Ocean Chlorophyll",
        type: "ocean" as const,
        latitude: 0,
        longitude: 120,
        priority: 75,
        observationFrequency: "weekly" as const,
        requiredResolution: 300,
        spectralBands: ["B", "G", "R", "NIR"],
        minCloudCover: 50,
      },
    ];

    for (const target of targets) {
      this.observer.registerTarget(target);
    }

    this.logger.info({ count: targets.length }, "Sample targets registered");
  }

  /**
   * Setup routes
   */
  private setupRoutes(): void {
    // Health check
    this.app.get("/health", (req: Request, res: Response) => {
      res.json({
        status: "healthy",
        serviceId: this.serviceId,
        targets: 3,
        campaigns: 0,
      });
    });

    // === OBSERVATION MANAGEMENT ===

    // Register science target
    this.app.post("/targets", (req: Request, res: Response) => {
      const {
        targetId,
        name,
        type,
        latitude,
        longitude,
        priority,
        observationFrequency,
        requiredResolution,
        spectralBands,
        minCloudCover,
      } = req.body;

      if (!targetId || !name || !type) {
        return res.status(400).json({
          error: "targetId, name, and type are required",
        });
      }

      const target = this.observer.registerTarget({
        targetId,
        name,
        type,
        latitude,
        longitude,
        priority: priority || 50,
        observationFrequency,
        requiredResolution,
        spectralBands,
        minCloudCover: minCloudCover || 50,
      });

      res.json({
        status: "registered",
        targetId: target.targetId,
        name: target.name,
        priority: target.priority,
      });
    });

    // Get target
    this.app.get("/targets/:targetId", (req: Request, res: Response) => {
      const target = this.observer.getTarget(req.params.targetId);

      if (!target) {
        return res.status(404).json({ error: "Target not found" });
      }

      res.json(target);
    });

    // Get next observation target
    this.app.post("/targets/next", (req: Request, res: Response) => {
      const { satelliteId, currentPosition } = req.body;

      if (!satelliteId || !currentPosition) {
        return res.status(400).json({
          error: "satelliteId and currentPosition are required",
        });
      }

      const nextTarget = this.observer.getNextObservationTarget(
        satelliteId,
        currentPosition
      );

      if (!nextTarget) {
        return res.json({ status: "no_targets_available" });
      }

      const target = this.observer.getTarget(nextTarget);

      res.json({
        targetId: nextTarget,
        target: {
          name: target?.name,
          priority: target?.priority,
          location: { latitude: target?.latitude, longitude: target?.longitude },
        },
      });
    });

    // === CAMPAIGN MANAGEMENT ===

    // Create observation campaign
    this.app.post("/campaigns", (req: Request, res: Response) => {
      const {
        name,
        description,
        objectives,
        targetIds,
        priority = "medium",
        durationDays = 30,
      } = req.body;

      if (!name || !objectives || !targetIds || !Array.isArray(targetIds)) {
        return res.status(400).json({
          error: "name, objectives array, and targetIds array are required",
        });
      }

      const campaign = this.observer.createCampaign(
        name,
        description || "",
        objectives,
        targetIds,
        priority,
        durationDays
      );

      res.json({
        campaignId: campaign.campaignId,
        name: campaign.name,
        status: campaign.status,
        targets: campaign.targets.length,
      });
    });

    // Get campaign
    this.app.get("/campaigns/:campaignId", (req: Request, res: Response) => {
      const campaign = this.observer.getCampaign(req.params.campaignId);

      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      const status = this.observer.getCampaignStatus(req.params.campaignId);

      res.json({
        campaign,
        status,
      });
    });

    // Activate campaign
    this.app.post("/campaigns/:campaignId/activate", (req: Request, res: Response) => {
      const success = this.observer.activateCampaign(req.params.campaignId);

      if (!success) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      res.json({ status: "activated", campaignId: req.params.campaignId });
    });

    // Complete campaign
    this.app.post("/campaigns/:campaignId/complete", (req: Request, res: Response) => {
      const success = this.observer.completeCampaign(req.params.campaignId);

      if (!success) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      res.json({ status: "completed", campaignId: req.params.campaignId });
    });

    // Get active campaigns
    this.app.get("/campaigns", (req: Request, res: Response) => {
      const campaigns = this.observer.getActiveCampaigns();

      res.json({
        count: campaigns.length,
        campaigns: campaigns.map((c) => ({
          campaignId: c.campaignId,
          name: c.name,
          status: c.status,
          progress: c.progress,
          dataCollected: c.dataCollected.toFixed(1),
        })),
      });
    });

    // === OBSERVATION RECORDING ===

    // Record observation
    this.app.post("/observations", (req: Request, res: Response) => {
      const {
        campaignId,
        targetId,
        satellite,
        cloudCover,
        quality,
        dataSizeMb,
        bands,
        coordinates,
      } = req.body;

      if (
        !campaignId ||
        !targetId ||
        !satellite ||
        !coordinates
      ) {
        return res.status(400).json({
          error: "All observation parameters are required",
        });
      }

      const observation = this.observer.recordObservation(
        campaignId,
        targetId,
        satellite,
        cloudCover || 0,
        quality || 85,
        dataSizeMb || 100,
        bands || ["R", "G", "B"],
        coordinates
      );

      res.json({
        observationId: observation.eventId,
        targetId,
        dataSize: dataSizeMb,
        quality: quality || 85,
        anomaliesDetected: observation.anomaliesDetected.length,
      });
    });

    // === DATA ANALYSIS ===

    // Analyze observation
    this.app.post("/analysis", (req: Request, res: Response) => {
      const { observationId, imageData, targetContext } = req.body;

      if (!observationId || !imageData) {
        return res.status(400).json({
          error: "observationId and imageData are required",
        });
      }

      const analysis = this.analyzer.analyzeObservationData(
        observationId,
        imageData,
        targetContext || "general"
      );

      res.json({
        resultId: analysis.resultId,
        findings: analysis.findings,
        confidence: (analysis.confidence * 100).toFixed(1),
        actionItems: analysis.actionItems,
        priority: analysis.priority,
      });
    });

    // Get unprocessed alerts
    this.app.get("/alerts/unprocessed", (req: Request, res: Response) => {
      const alerts = this.analyzer.getUnprocessedAlerts();

      res.json({
        count: alerts.length,
        alerts: alerts.map((a) => ({
          alertId: a.alertId,
          type: a.type,
          severity: a.severity,
          description: a.description,
          suggestedAction: a.suggestedAction,
          timestamp: new Date(a.timestamp).toISOString(),
        })),
      });
    });

    // Process alert
    this.app.post("/alerts/:alertId/process", (req: Request, res: Response) => {
      const success = this.analyzer.processAlert(req.params.alertId);

      if (!success) {
        return res.status(404).json({ error: "Alert not found" });
      }

      res.json({ status: "processed", alertId: req.params.alertId });
    });

    // === MISSION PLANNING ===

    // Create adaptive mission plan
    this.app.post("/missions/plan", (req: Request, res: Response) => {
      const {
        missionId,
        objectives,
        targetSequence,
        estimatedDuration,
      } = req.body;

      if (!missionId || !objectives || !targetSequence) {
        return res.status(400).json({
          error: "missionId, objectives, and targetSequence are required",
        });
      }

      const plan = this.analyzer.createAdaptiveMissionPlan(
        missionId,
        objectives,
        targetSequence,
        estimatedDuration || 24
      );

      res.json({
        planId: plan.planId,
        status: plan.status,
        adaptationScore: plan.adaptationScore.toFixed(1),
        targets: plan.targetSequence.length,
        successCriteria: plan.successCriteria,
      });
    });

    // Approve mission plan
    this.app.post("/missions/:planId/approve", (req: Request, res: Response) => {
      const success = this.analyzer.approveMissionPlan(req.params.planId);

      if (!success) {
        return res.status(404).json({ error: "Mission plan not found" });
      }

      res.json({ status: "approved", planId: req.params.planId });
    });

    // Start mission execution
    this.app.post("/missions/:planId/start", (req: Request, res: Response) => {
      const success = this.analyzer.startMissionExecution(req.params.planId);

      if (!success) {
        return res.status(400).json({ error: "Mission plan not approved" });
      }

      res.json({ status: "executing", planId: req.params.planId });
    });

    // === ANOMALIES ===

    // Get high-priority anomalies
    this.app.get("/anomalies/high-priority", (req: Request, res: Response) => {
      const anomalies = this.observer.getHighPriorityAnomalies();

      res.json({
        count: anomalies.length,
        anomalies: anomalies.map((a) => ({
          anomalyId: a.anomalyId,
          type: a.type,
          severity: a.severity,
          location: a.location,
          confidence: (a.confidence * 100).toFixed(1),
          status: a.status,
        })),
      });
    });

    // Flag anomaly for follow-up
    this.app.post("/anomalies/:anomalyId/followup", (req: Request, res: Response) => {
      const success = this.observer.flagAnomalyForFollowUp(req.params.anomalyId);

      if (!success) {
        return res.status(404).json({ error: "Anomaly not found" });
      }

      res.json({
        status: "flagged",
        anomalyId: req.params.anomalyId,
        action: "Follow-up observation scheduled",
      });
    });

    // === STATISTICS ===

    // Get scientific metrics
    this.app.get("/metrics/scientific", (req: Request, res: Response) => {
      const metrics = this.observer.getScientificMetrics();
      res.json(metrics);
    });

    // Get processing metrics
    this.app.get("/metrics/processing", (req: Request, res: Response) => {
      const metrics = this.analyzer.getProcessingMetrics();
      res.json(metrics);
    });

    // Get comprehensive stats
    this.app.get("/stats", (req: Request, res: Response) => {
      const scientific = this.observer.getScientificMetrics();
      const processing = this.analyzer.getProcessingMetrics();

      res.json({
        scientific,
        processing,
        combined: {
          totalProductivity:
            (scientific.missionSuccess * 100 +
              processing.averageConfidence * 100) /
            2,
          systemLoad: (
            ((processing.queuedObservations + processing.activeAlerts) /
              (processing.queuedObservations +
                processing.processedObservations +
                1)) *
            100
          ).toFixed(1),
        },
      });
    });
  }

  /**
   * Start service
   */
  start(): void {
    this.app.listen(this.port, () => {
      this.logger.info(
        {
          port: this.port,
          serviceId: this.serviceId,
        },
        "Science Operations Service started"
      );
    });
  }
}

// Export service
export default ScienceOpsService;

// Start if run directly
if (require.main === module) {
  const service = new ScienceOpsService(3010);
  service.start();
}
