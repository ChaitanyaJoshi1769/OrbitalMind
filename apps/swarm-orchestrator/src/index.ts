/**
 * Swarm Orchestrator Service
 * Coordinates multi-satellite operations using:
 * - RAFT consensus for distributed decisions
 * - ISL routing algorithms for inter-satellite communication
 * - Formation flying control for satellite positioning
 * - Collision avoidance
 */

import express, { Express, Request, Response } from "express";
import http from "http";
import { v4 as uuidv4 } from "uuid";
import pino from "pino";
import { RaftCluster, LogEntryType } from "./consensus/raft";
import { DijkstraRouter, GreedyRouter, LinkQualityMonitor, TopologyChangeDetector, type ISLLink, type TopologySnapshot } from "./algorithms/isl-routing";
import { PDFormationController, ConsensusFormationController, CollisionAvoidanceController, FormationShapes, type SatelliteState, type Vector3D } from "./algorithms/formation-control";

interface SwarmCommand {
  id: string;
  type: "FORM" | "REPOSITION" | "REROUTE" | "EMERGENCY";
  targetFormation?: string;
  targetSatellites?: string[];
  priority: number;
  timestamp: number;
}

class SwarmOrchestratorService {
  private app: Express;
  private server: http.Server;
  private logger = pino();
  private raftCluster: RaftCluster;
  private routingMonitor: LinkQualityMonitor;
  private topologyDetector: TopologyChangeDetector;
  private formationController: PDFormationController;
  private collisionAvoidance: CollisionAvoidanceController;
  private commandQueue: Map<string, SwarmCommand> = new Map();
  private satelliteStates: Map<string, SatelliteState> = new Map();
  private topologySnapshot?: TopologySnapshot;

  constructor(satelliteCount: number = 16) {
    this.app = express();
    this.server = http.createServer(this.app);
    this.raftCluster = new RaftCluster();
    this.routingMonitor = new LinkQualityMonitor(100);
    this.topologyDetector = new TopologyChangeDetector();
    this.formationController = new PDFormationController();
    this.collisionAvoidance = new CollisionAvoidanceController();

    // Initialize RAFT nodes (one per satellite)
    const satelliteIds = Array.from({ length: satelliteCount }, (_, i) =>
      `SAT-${String(i + 1).padStart(3, "0")}`
    );

    satelliteIds.forEach((satId) => {
      const otherIds = satelliteIds.filter((id) => id !== satId);
      const node = this.raftCluster.addNode(satId, otherIds);

      // Setup callbacks
      node.setLeaderElectedCallback(async (leaderId) => {
        this.logger.info({ leaderId }, "Leader elected in RAFT");
        await this.broadcastLeaderChange(leaderId);
      });

      node.setEntryCommittedCallback(async (entry) => {
        this.logger.info({ entry }, "Entry committed");
        await this.executeCommittedEntry(entry);
      });
    });

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use((req, res, next) => {
      const requestId = uuidv4();
      res.setHeader("X-Request-ID", requestId);
      (req as any).id = requestId;
      next();
    });
  }

  private setupRoutes(): void {
    // Swarm state
    this.app.get("/api/v1/swarm/state", this.handleSwarmState.bind(this));

    // Formation control
    this.app.post("/api/v1/swarm/formation", this.handleFormationCommand.bind(this));
    this.app.get("/api/v1/swarm/formation/status", this.handleFormationStatus.bind(this));

    // ISL Routing
    this.app.post("/api/v1/swarm/routing/calculate", this.handleCalculateRoute.bind(this));
    this.app.get("/api/v1/swarm/routing/topology", this.handleGetTopology.bind(this));
    this.app.post("/api/v1/swarm/topology/update", this.handleTopologyUpdate.bind(this));

    // RAFT consensus
    this.app.get("/api/v1/swarm/consensus/status", this.handleConsensusStatus.bind(this));
    this.app.post("/api/v1/swarm/consensus/propose", this.handleProposeEntry.bind(this));

    // Collision avoidance
    this.app.get("/api/v1/swarm/safety/risks", this.handleCollisionRisks.bind(this));

    // Health check
    this.app.get("/api/v1/health", this.handleHealthCheck.bind(this));
  }

  private async handleSwarmState(req: Request, res: Response): Promise<void> {
    const stats = this.raftCluster.getStats();
    const degradedLinks = this.routingMonitor.getDegradedLinks();
    const collisionRisks = this.collisionAvoidance.checkCollisionRisk(
      Array.from(this.satelliteStates.values())
    );

    res.status(200).json({
      timestamp: new Date().toISOString(),
      raftCluster: stats,
      satelliteCount: this.satelliteStates.size,
      topology: this.topologySnapshot,
      linkQuality: {
        degraded: degradedLinks.length,
        details: degradedLinks.slice(0, 5),
      },
      collisionRisks: {
        total: collisionRisks.length,
        critical: collisionRisks.filter((r) => r.riskLevel > 0.8).length,
        details: collisionRisks.slice(0, 5),
      },
      commandQueue: this.commandQueue.size,
    });
  }

  private async handleFormationCommand(req: Request, res: Response): Promise<void> {
    const { formationType, targetSatellites, priority = 5 } = req.body;

    if (!formationType) {
      res.status(400).json({ error: "formationType is required" });
      return;
    }

    const formation = this.getFormation(formationType, targetSatellites?.length || 16);

    const command: SwarmCommand = {
      id: uuidv4(),
      type: "FORM",
      targetFormation: formationType,
      targetSatellites: targetSatellites,
      priority,
      timestamp: Date.now(),
    };

    this.commandQueue.set(command.id, command);

    // Propose to RAFT consensus
    const leader = this.raftCluster.getLeader();
    if (leader) {
      const node = this.raftCluster.getNode(leader);
      if (node) {
        await node.proposeEntry(LogEntryType.FORMATION_COMMAND, {
          command,
          formation,
        });
      }
    }

    res.status(202).json({
      commandId: command.id,
      status: "accepted",
      estimatedExecutionMs: 5000,
    });
  }

  private async handleFormationStatus(req: Request, res: Response): Promise<void> {
    const formations = {
      LINEAR: FormationShapes.createLinearFormation(16),
      CIRCULAR: FormationShapes.createCircularFormation(16),
      GRID: FormationShapes.createGridFormation(4, 4),
      TETRAHEDRAL: FormationShapes.createTetrahedralFormation(),
    };

    res.status(200).json({
      availableFormations: Object.keys(formations),
      currentCommands: Array.from(this.commandQueue.values()),
    });
  }

  private async handleCalculateRoute(req: Request, res: Response): Promise<void> {
    const { source, destination, algorithm = "dijkstra" } = req.body;

    if (!source || !destination || !this.topologySnapshot) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    const satelliteIds = Array.from(this.satelliteStates.keys());

    let path: any;
    if (algorithm === "dijkstra") {
      path = DijkstraRouter.findShortestPath(
        this.topologySnapshot,
        source,
        destination,
        satelliteIds
      );
    } else if (algorithm === "disjoint") {
      const paths = DijkstraRouter.findDisjointPaths(
        this.topologySnapshot,
        source,
        destination,
        satelliteIds,
        3
      );
      path = paths[0];
    }

    if (!path) {
      res.status(404).json({ error: "No route found" });
      return;
    }

    res.status(200).json({
      source,
      destination,
      path: path.hops,
      metrics: {
        latency: path.latency,
        bandwidth: path.bandwidth,
        reliability: path.reliability,
      },
    });
  }

  private async handleGetTopology(req: Request, res: Response): Promise<void> {
    res.status(200).json(this.topologySnapshot || {});
  }

  private async handleTopologyUpdate(req: Request, res: Response): Promise<void> {
    const { topology } = req.body;

    if (!topology || !topology.links) {
      res.status(400).json({ error: "Invalid topology" });
      return;
    }

    this.topologySnapshot = topology;

    // Detect changes
    const changes = this.topologyDetector.detectChanges(topology);

    this.logger.info(
      { changes: { added: changes.added.length, removed: changes.removed.length } },
      "Topology updated"
    );

    res.status(200).json({
      status: "updated",
      changeDetected: changes.isSignificant,
      changePercentage: changes.changePercentage,
    });
  }

  private async handleConsensusStatus(req: Request, res: Response): Promise<void> {
    const stats = this.raftCluster.getStats();

    res.status(200).json({
      consensus: {
        leaders: stats.leaders,
        followers: stats.followers,
        candidates: stats.candidates,
        totalNodes: stats.totalNodes,
      },
      clusterHealth: {
        hasLeader: stats.leaders.length > 0,
        quorumReached: stats.followers.length + stats.leaders.length > stats.totalNodes / 2,
      },
    });
  }

  private async handleProposeEntry(req: Request, res: Response): Promise<void> {
    const { type, data } = req.body;

    const leader = this.raftCluster.getLeader();
    if (!leader) {
      res.status(503).json({ error: "No leader available" });
      return;
    }

    const node = this.raftCluster.getNode(leader);
    if (!node) {
      res.status(503).json({ error: "Leader not found" });
      return;
    }

    const result = await node.proposeEntry(type as LogEntryType, data);

    if (result.success) {
      res.status(202).json({ status: "proposed", index: result.index });
    } else {
      res.status(503).json({ error: result.error });
    }
  }

  private async handleCollisionRisks(req: Request, res: Response): Promise<void> {
    const risks = this.collisionAvoidance.checkCollisionRisk(
      Array.from(this.satelliteStates.values())
    );

    const critical = risks.filter((r) => r.riskLevel > 0.8);
    const high = risks.filter((r) => r.riskLevel > 0.5 && r.riskLevel <= 0.8);
    const medium = risks.filter((r) => r.riskLevel > 0.2 && r.riskLevel <= 0.5);

    res.status(200).json({
      totalRisks: risks.length,
      bySeverity: { critical: critical.length, high: high.length, medium: medium.length },
      details: risks.slice(0, 10),
    });
  }

  private async handleHealthCheck(req: Request, res: Response): Promise<void> {
    const stats = this.raftCluster.getStats();

    res.status(200).json({
      status: "healthy",
      service: "swarm-orchestrator",
      uptime: process.uptime(),
      satellites: this.satelliteStates.size,
      raftHealth: {
        hasLeader: stats.leaders.length > 0,
        totalNodes: stats.totalNodes,
      },
      memoryUsage: {
        heapUsed: process.memoryUsage().heapUsed / 1024 / 1024,
        heapTotal: process.memoryUsage().heapTotal / 1024 / 1024,
      },
    });
  }

  private setupErrorHandling(): void {
    this.app.use((err: any, req: Request, res: Response) => {
      this.logger.error(err);
      res.status(500).json({ error: "Internal server error" });
    });
  }

  private async broadcastLeaderChange(leaderId: string): Promise<void> {
    this.logger.info({ leaderId }, "Broadcasting leader change");
  }

  private async executeCommittedEntry(entry: any): Promise<void> {
    this.logger.info({ entry }, "Executing committed entry");
  }

  private getFormation(
    type: string,
    satelliteCount: number
  ): Record<string, Vector3D> {
    const typeUpper = type.toUpperCase();

    switch (typeUpper) {
      case "LINEAR":
        return FormationShapes.createLinearFormation(satelliteCount, 100);
      case "CIRCULAR":
        return FormationShapes.createCircularFormation(satelliteCount, 500);
      case "GRID": {
        const sqrtCount = Math.ceil(Math.sqrt(satelliteCount));
        return FormationShapes.createGridFormation(sqrtCount, sqrtCount, 100);
      }
      case "TETRAHEDRAL":
        return FormationShapes.createTetrahedralFormation(500);
      default:
        return FormationShapes.createLinearFormation(satelliteCount, 100);
    }
  }

  async start(port: number = 3003): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.raftCluster.startAll().catch((err) => this.logger.error(err));

        this.server.listen(port, () => {
          this.logger.info(`Swarm Orchestrator listening on port ${port}`);
          resolve();
        });
      } catch (error) {
        this.logger.error(error);
        reject(error);
      }
    });
  }

  async shutdown(): Promise<void> {
    await this.raftCluster.shutdownAll();

    return new Promise((resolve) => {
      this.server.close(() => {
        this.logger.info("Swarm Orchestrator shut down gracefully");
        resolve();
      });
    });
  }
}

const service = new SwarmOrchestratorService(16);
service.start(3003).catch((error) => {
  console.error("Failed to start Swarm Orchestrator:", error);
  process.exit(1);
});

process.on("SIGTERM", async () => {
  console.log("SIGTERM received");
  await service.shutdown();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT received");
  await service.shutdown();
  process.exit(0);
});

export { SwarmOrchestratorService };
