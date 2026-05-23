/**
 * Space Traffic Management Service
 *
 * Orbital safety and traffic coordination:
 * - Collision avoidance
 * - Debris tracking
 * - Maneuver coordination
 * - Multi-constellation traffic rules
 * - Space situational awareness (SSA)
 */

import express, { Express, Request, Response } from "express";
import pino from "pino";
import { randomUUID } from "crypto";

import CollisionAvoidanceEngine from "./collision/collision-avoidance";
import SpaceTrafficCoordinator from "./coordination/traffic-coordinator";

/**
 * Space Traffic Service
 */
export class SpaceTrafficService {
  private app: Express;
  private logger = pino();
  private collisionAvoidance: CollisionAvoidanceEngine;
  private trafficCoordinator: SpaceTrafficCoordinator;
  private serviceId: string;

  constructor(private port: number = 3009) {
    this.app = express();
    this.serviceId = randomUUID();
    this.collisionAvoidance = new CollisionAvoidanceEngine();
    this.trafficCoordinator = new SpaceTrafficCoordinator();

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
    // Register constellations
    this.trafficCoordinator.registerConstellation(
      "ORBITALSAT-LEO",
      "OrbitalMind LEO",
      50,
      ["LEO-500-600"],
      "coordinator-001"
    );

    this.trafficCoordinator.registerConstellation(
      "COMPETITOR-LEO",
      "Competitor LEO Constellation",
      40,
      ["LEO-500-600", "LEO-400-500"],
      "coordinator-002"
    );

    // Add sample debris
    for (let i = 0; i < 10; i++) {
      this.collisionAvoidance.addDebrisObject({
        debrisId: `DEBRIS-${i}`,
        type: i % 3 === 0 ? "rocket_body" : "fragmentation",
        estimatedMass: 50 + Math.random() * 500,
        size: 5 + Math.random() * 20,
        position: {
          x: 6800 + Math.random() * 100,
          y: 1000 + Math.random() * 100,
          z: 500 + Math.random() * 100,
        },
        velocity: {
          x: 7.5 + Math.random() * 0.5,
          y: 0.1 + Math.random() * 0.1,
          z: 0.1 + Math.random() * 0.1,
        },
        hazardRating: 30 + Math.random() * 50,
        lastObserved: Date.now(),
        detectionConfidence: 0.85 + Math.random() * 0.15,
      });
    }

    this.logger.info("Sample space traffic data initialized");
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
        collisionAssessments: 0,
        debrisObjects: 10,
      });
    });

    // === COLLISION AVOIDANCE ROUTES ===

    // Assess conjunction
    this.app.post("/collision/assess", (req: Request, res: Response) => {
      const {
        primarySat,
        secondarySat,
        timeOfClosestApproach,
        primaryPosition,
        secondaryPosition,
        primaryVelocity,
        secondaryVelocity,
        uncertainty = 1.0,
      } = req.body;

      if (
        !primarySat ||
        !secondarySat ||
        !timeOfClosestApproach ||
        !primaryPosition ||
        !secondaryPosition ||
        !primaryVelocity ||
        !secondaryVelocity
      ) {
        return res.status(400).json({
          error: "All conjunction parameters are required",
        });
      }

      const assessment = this.collisionAvoidance.assessConjunction(
        primarySat,
        secondarySat,
        timeOfClosestApproach,
        primaryPosition,
        secondaryPosition,
        primaryVelocity,
        secondaryVelocity,
        uncertainty
      );

      res.json({
        assessmentId: assessment.assessmentId,
        minDistance: assessment.minimumDistance.toFixed(2),
        probability: (assessment.collisionProbability * 1000000).toFixed(2),
        riskLevel: assessment.riskLevel,
        timeOfClosestApproach: new Date(assessment.timeOfClosestApproach).toISOString(),
      });
    });

    // Plan maneuver
    this.app.post("/collision/maneuver/plan", (req: Request, res: Response) => {
      const { conjunctionId, targetSatellite } = req.body;

      if (!conjunctionId || !targetSatellite) {
        return res.status(400).json({
          error: "conjunctionId and targetSatellite are required",
        });
      }

      const maneuver = this.collisionAvoidance.planManeuver(
        conjunctionId,
        targetSatellite
      );

      if (!maneuver) {
        return res.status(404).json({ error: "Conjunction not found" });
      }

      res.json({
        maneuverID: maneuver.maneuverID,
        type: maneuver.maneuverType,
        deltaV: {
          magnitude: maneuver.deltaVMagnitude.toFixed(3),
          vector: maneuver.deltaVRequired,
        },
        fuelRequired: maneuver.fuelRequired.toFixed(1),
        burnTime: new Date(maneuver.burnTime).toISOString(),
        expectedOutcome: {
          newMinDistance: maneuver.expectedOutcome.newMinDistance.toFixed(2),
          newProbability: (
            maneuver.expectedOutcome.newCollisionProbability * 1000000
          ).toFixed(2),
          newRiskLevel: maneuver.expectedOutcome.newRiskLevel,
        },
      });
    });

    // Execute maneuver
    this.app.post("/collision/maneuver/execute", (req: Request, res: Response) => {
      const { maneuverID } = req.body;

      if (!maneuverID) {
        return res.status(400).json({ error: "maneuverID is required" });
      }

      const maneuver = this.collisionAvoidance.getManeuver(maneuverID);
      if (!maneuver) {
        return res.status(404).json({ error: "Maneuver not found" });
      }

      // Set to approved first (in real system, would require authorization)
      maneuver.status = "approved";

      const success = this.collisionAvoidance.executeManeuver(maneuverID);

      if (!success) {
        return res.status(400).json({ error: "Failed to execute maneuver" });
      }

      res.json({
        status: "executing",
        maneuverID,
        targetSatellite: maneuver.targetSatellite,
        duration: maneuver.duration,
      });
    });

    // Get high-risk conjunctions
    this.app.get("/collision/high-risk", (req: Request, res: Response) => {
      const conjunctions = this.collisionAvoidance.getHighRiskConjunctions();

      res.json({
        count: conjunctions.length,
        conjunctions: conjunctions.map((c) => ({
          assessmentId: c.assessmentId,
          satellites: [c.primarySat, c.secondarySat],
          minDistance: c.minimumDistance.toFixed(2),
          probability: (c.collisionProbability * 1000000).toFixed(2),
          riskLevel: c.riskLevel,
          timeOfCA: new Date(c.timeOfClosestApproach).toISOString(),
        })),
      });
    });

    // Add debris object
    this.app.post("/debris/add", (req: Request, res: Response) => {
      const {
        debrisId,
        type,
        estimatedMass,
        size,
        position,
        velocity,
        hazardRating,
        detectionConfidence = 0.9,
      } = req.body;

      if (
        !debrisId ||
        !type ||
        !position ||
        !velocity ||
        !hazardRating
      ) {
        return res.status(400).json({
          error: "All debris parameters are required",
        });
      }

      this.collisionAvoidance.addDebrisObject({
        debrisId,
        type,
        estimatedMass: estimatedMass || 50,
        size: size || 10,
        position,
        velocity,
        hazardRating,
        lastObserved: Date.now(),
        detectionConfidence,
      });

      res.json({
        status: "added",
        debrisId,
        hazardRating,
      });
    });

    // Get high-risk debris
    this.app.get("/debris/high-risk", (req: Request, res: Response) => {
      const { threshold = 50 } = req.query;
      const debris = this.collisionAvoidance.getHighRiskDebris(
        Number(threshold)
      );

      res.json({
        count: debris.length,
        threshold: Number(threshold),
        debris: debris.map((d) => ({
          debrisId: d.debrisId,
          type: d.type,
          size: d.size,
          hazardRating: d.hazardRating,
          distance: Math.sqrt(
            d.position.x ** 2 + d.position.y ** 2 + d.position.z ** 2
          ).toFixed(2),
        })),
      });
    });

    // Check satellite against debris
    this.app.post("/debris/check-satellite", (req: Request, res: Response) => {
      const { satelliteId, position, velocity } = req.body;

      if (!satelliteId || !position || !velocity) {
        return res.status(400).json({
          error: "satelliteId, position, and velocity are required",
        });
      }

      const conjunctions =
        this.collisionAvoidance.checkDebrisConjunctions(
          satelliteId,
          position,
          velocity
        );

      res.json({
        satellite: satelliteId,
        debrisConjunctions: conjunctions.length,
        alerts: conjunctions
          .filter((c) => c.riskLevel !== "safe")
          .map((c) => ({
            debris: c.secondarySat,
            minDistance: c.minimumDistance.toFixed(2),
            riskLevel: c.riskLevel,
            probability: (c.collisionProbability * 1000000).toFixed(2),
          })),
      });
    });

    // === TRAFFIC COORDINATION ROUTES ===

    // Register constellation
    this.app.post("/traffic/constellation/register", (req: Request, res: Response) => {
      const {
        constellationId,
        name,
        satelliteCount,
        orbitalRegions,
        coordinatorId,
      } = req.body;

      if (
        !constellationId ||
        !name ||
        !orbitalRegions
      ) {
        return res.status(400).json({
          error: "constellationId, name, and orbitalRegions are required",
        });
      }

      this.trafficCoordinator.registerConstellation(
        constellationId,
        name,
        satelliteCount || 50,
        orbitalRegions,
        coordinatorId || "unknown"
      );

      res.json({
        status: "registered",
        constellationId,
        name,
      });
    });

    // Request maneuver coordination
    this.app.post("/traffic/maneuver/request", (req: Request, res: Response) => {
      const {
        initiatingConstellation,
        satellite,
        deltaV,
        burnTime,
        estimatedDuration,
        priority = "medium",
        reason = "Routine maneuver",
      } = req.body;

      if (
        !initiatingConstellation ||
        !satellite ||
        !deltaV ||
        !burnTime ||
        !estimatedDuration
      ) {
        return res.status(400).json({
          error: "All maneuver parameters are required",
        });
      }

      const request = this.trafficCoordinator.requestManeuverCoordination(
        initiatingConstellation,
        satellite,
        deltaV,
        burnTime,
        estimatedDuration,
        priority,
        reason
      );

      res.json({
        requestId: request.requestId,
        status: request.status,
        satellite: request.satellite,
        burnTime: new Date(request.burnTime).toISOString(),
      });
    });

    // Get orbital regions
    this.app.get("/traffic/regions", (req: Request, res: Response) => {
      const regions = this.trafficCoordinator.getAllRegions();

      res.json({
        count: regions.length,
        regions: regions.map((r) => ({
          regionId: r.regionId,
          altitude: r.altitude,
          inclination: r.inclination,
          capacity: r.capacity,
          occupancy: r.currentOccupancy,
          congestion: (r.congestionLevel * 100).toFixed(1),
          restricted: r.restrictedUse,
        })),
      });
    });

    // Forecast region traffic
    this.app.post("/traffic/forecast", (req: Request, res: Response) => {
      const { regionId, hoursAhead = 24 } = req.body;

      if (!regionId) {
        return res.status(400).json({ error: "regionId is required" });
      }

      try {
        const forecast =
          this.trafficCoordinator.forecastRegionTraffic(
            regionId,
            hoursAhead
          );

        res.json({
          forecast: {
            region: forecast.regionId,
            forecastHours: hoursAhead,
            predictedOccupancy: forecast.predictedOccupancy,
            predictedCongestion: (forecast.predictedCongestion * 100).toFixed(1),
            expectedManeuvers: forecast.expectedManeuvers,
            potentialConjunctions: forecast.potentialConjunctions,
            risks: forecast.risksIdentified,
          },
        });
      } catch (error) {
        res.status(404).json({ error: "Region not found" });
      }
    });

    // Send coordination message
    this.app.post("/traffic/message/send", (req: Request, res: Response) => {
      const {
        sender,
        recipient,
        messageType,
        content,
        priority = "medium",
        responseRequired = false,
      } = req.body;

      if (!sender || !recipient || !messageType || !content) {
        return res.status(400).json({
          error: "sender, recipient, messageType, and content are required",
        });
      }

      const message = this.trafficCoordinator.sendMessage(
        sender,
        recipient,
        messageType,
        content,
        priority,
        responseRequired
      );

      res.json({
        status: "sent",
        messageId: message.messageId,
        recipient,
        priority,
      });
    });

    // Get high-priority messages
    this.app.get("/traffic/messages/high-priority", (req: Request, res: Response) => {
      const messages = this.trafficCoordinator.getHighPriorityMessages();

      res.json({
        count: messages.length,
        messages: messages.map((m) => ({
          messageId: m.messageId,
          from: m.sender,
          type: m.messageType,
          priority: m.priority,
          timestamp: new Date(m.timestamp).toISOString(),
          acknowledged: m.acknowledged,
        })),
      });
    });

    // System statistics
    this.app.get("/stats", (req: Request, res: Response) => {
      const caStats = this.collisionAvoidance.getStatistics();
      const tcStats = this.trafficCoordinator.getStatistics();

      res.json({
        collisionAvoidance: caStats,
        trafficCoordination: tcStats,
        systemStatus: {
          safetyLevel:
            caStats.criticalConjunctions === 0 ? "green" : "red",
          trafficCongestion: tcStats.averageCongestion,
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
        "Space Traffic Service started"
      );
    });
  }
}

// Export service
export default SpaceTrafficService;

// Start if run directly
if (require.main === module) {
  const service = new SpaceTrafficService(3009);
  service.start();
}
