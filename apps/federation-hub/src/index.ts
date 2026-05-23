/**
 * Federation Hub Service
 * 
 * Coordinates:
 * - Multi-ground station networks
 * - Inter-constellation handoffs
 * - Global resource allocation
 * - Cross-operator agreements
 */

import express, { Express, Request, Response } from "express";
import http from "http";
import { v4 as uuidv4 } from "uuid";
import pino from "pino";
import { GroundStationManager, GroundStationConfig, SatellitePass } from "./groundstations/station-manager";
import { ConstellationFederation, ConstellationConfig, ConstellationMember, ServiceAgreement, ResourceAllocation, HandoffRequest } from "./constellations/constellation-federation";

class FederationHubService {
  private app: Express;
  private server: http.Server;
  private logger = pino();
  private stationManager: GroundStationManager;
  private constellationFederation: ConstellationFederation;
  private requestCache: Map<string, any> = new Map();

  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.stationManager = new GroundStationManager();
    this.constellationFederation = new ConstellationFederation();

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
    this.initializeSampleData();
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
    // Ground Station Management
    this.app.post("/api/v1/federation/stations/register", this.handleRegisterStation.bind(this));
    this.app.get("/api/v1/federation/stations/:stationId", this.handleGetStation.bind(this));
    this.app.get("/api/v1/federation/stations/region/:region", this.handleGetStationsByRegion.bind(this));
    this.app.get("/api/v1/federation/stations", this.handleGetAllStations.bind(this));

    // Visibility and Contact Windows
    this.app.post("/api/v1/federation/visibility/calculate", this.handleCalculateVisibility.bind(this));
    this.app.post("/api/v1/federation/contacts/schedule", this.handleScheduleContact.bind(this));
    this.app.get("/api/v1/federation/contacts/active", this.handleGetActiveContacts.bind(this));
    this.app.get("/api/v1/federation/contacts/satellite/:satelliteId", this.handleGetSatelliteContacts.bind(this));

    // Station Selection
    this.app.post("/api/v1/federation/station/select", this.handleSelectStation.bind(this));
    this.app.get("/api/v1/federation/network/status", this.handleNetworkStatus.bind(this));

    // Constellation Federation
    this.app.post("/api/v1/federation/constellations/register", this.handleRegisterConstellation.bind(this));
    this.app.get("/api/v1/federation/constellations/:constellationId", this.handleGetConstellation.bind(this));
    this.app.get("/api/v1/federation/constellations", this.handleListConstellations.bind(this));

    // Inter-Constellation Handoffs
    this.app.post("/api/v1/federation/handoff/request", this.handleRequestHandoff.bind(this));
    this.app.post("/api/v1/federation/handoff/complete", this.handleCompleteHandoff.bind(this));
    this.app.get("/api/v1/federation/handoff/status/:requestId", this.handleHandoffStatus.bind(this));
    this.app.get("/api/v1/federation/handoff/statistics", this.handleHandoffStats.bind(this));

    // Constellation Selection for Handoff
    this.app.post("/api/v1/federation/handoff/target", this.handleSelectHandoffTarget.bind(this));

    // Federation Status
    this.app.get("/api/v1/federation/status", this.handleFederationStatus.bind(this));
    this.app.get("/api/v1/health", this.handleHealthCheck.bind(this));
  }

  private async handleRegisterStation(req: Request, res: Response): Promise<void> {
    const config: GroundStationConfig = req.body;

    try {
      this.stationManager.registerStation(config);
      res.status(201).json({ status: "registered", stationId: config.stationId });
    } catch (error) {
      this.logger.error(error);
      res.status(400).json({ error: "Invalid configuration" });
    }
  }

  private async handleGetStation(req: Request, res: Response): Promise<void> {
    const { stationId } = req.params;
    const station = this.stationManager.getStation(stationId);

    if (!station) {
      res.status(404).json({ error: "Station not found" });
      return;
    }

    res.status(200).json(station);
  }

  private async handleGetStationsByRegion(req: Request, res: Response): Promise<void> {
    const { region } = req.params;
    const stations = this.stationManager.getStationsByRegion(region);

    res.status(200).json({ region, stations, count: stations.length });
  }

  private async handleGetAllStations(req: Request, res: Response): Promise<void> {
    const status = this.stationManager.getNetworkStatus();
    res.status(200).json(status);
  }

  private async handleCalculateVisibility(req: Request, res: Response): Promise<void> {
    const { satelliteId, stationId } = req.body;

    try {
      const pass = this.stationManager.calculateVisibilityWindow(
        satelliteId,
        stationId,
        Date.now()
      );

      if (!pass) {
        res.status(404).json({ error: "Station not found" });
        return;
      }

      res.status(200).json(pass);
    } catch (error) {
      this.logger.error(error);
      res.status(500).json({ error: "Calculation failed" });
    }
  }

  private async handleScheduleContact(req: Request, res: Response): Promise<void> {
    const { satelliteId, stationId, startTime, endTime, type, priority, dataVolume } = req.body;

    try {
      const contactId = this.stationManager.scheduleContact(
        satelliteId,
        stationId,
        startTime,
        endTime,
        type,
        priority,
        dataVolume
      );

      res.status(201).json({ contactId, status: "scheduled" });
    } catch (error) {
      this.logger.error(error);
      res.status(400).json({ error: "Schedule failed" });
    }
  }

  private async handleGetActiveContacts(req: Request, res: Response): Promise<void> {
    const contacts = this.stationManager.getActiveContacts();
    res.status(200).json({ activeContacts: contacts.length, contacts });
  }

  private async handleGetSatelliteContacts(req: Request, res: Response): Promise<void> {
    const { satelliteId } = req.params;
    const contacts = this.stationManager.getContactsForSatellite(satelliteId);

    res.status(200).json({ satelliteId, contacts: contacts.length, details: contacts });
  }

  private async handleSelectStation(req: Request, res: Response): Promise<void> {
    const { satelliteId, region } = req.body;

    const station = this.stationManager.selectNextStation(satelliteId, region);

    if (!station) {
      res.status(404).json({ error: "No suitable station found" });
      return;
    }

    res.status(200).json(station);
  }

  private async handleNetworkStatus(req: Request, res: Response): Promise<void> {
    const status = this.stationManager.getNetworkStatus();
    res.status(200).json(status);
  }

  private async handleRegisterConstellation(req: Request, res: Response): Promise<void> {
    const { config, member } = req.body;

    try {
      const success = this.constellationFederation.registerConstellation(config, member);

      if (!success) {
        res.status(400).json({ error: "Invalid configuration" });
        return;
      }

      res.status(201).json({ status: "registered", constellationId: config.constellationId });
    } catch (error) {
      this.logger.error(error);
      res.status(400).json({ error: "Registration failed" });
    }
  }

  private async handleGetConstellation(req: Request, res: Response): Promise<void> {
    const { constellationId } = req.params;
    const member = this.constellationFederation.getMember(constellationId);

    if (!member) {
      res.status(404).json({ error: "Constellation not found" });
      return;
    }

    res.status(200).json(member);
  }

  private async handleListConstellations(req: Request, res: Response): Promise<void> {
    const status = this.constellationFederation.getFederationStatus();
    res.status(200).json(status);
  }

  private async handleRequestHandoff(req: Request, res: Response): Promise<void> {
    const { sourceConstellation, targetConstellation, satelliteId, dataToTransfer, priority } = req.body;

    const result = this.constellationFederation.requestHandoff(
      sourceConstellation,
      targetConstellation,
      satelliteId,
      dataToTransfer,
      priority
    );

    const statusCode = result.accepted ? 202 : 400;
    res.status(statusCode).json(result);
  }

  private async handleCompleteHandoff(req: Request, res: Response): Promise<void> {
    const { requestId, dataTransferred, qualityScore } = req.body;

    const result = this.constellationFederation.completeHandoff(
      requestId,
      dataTransferred,
      qualityScore
    );

    if (!result) {
      res.status(404).json({ error: "Handoff request not found" });
      return;
    }

    res.status(200).json(result);
  }

  private async handleHandoffStatus(req: Request, res: Response): Promise<void> {
    const { requestId } = req.params;

    // In production, would track from persistent storage
    res.status(200).json({ requestId, status: "in_progress" });
  }

  private async handleHandoffStats(req: Request, res: Response): Promise<void> {
    const stats = this.constellationFederation.getHandoffStatistics();
    res.status(200).json(stats);
  }

  private async handleSelectHandoffTarget(req: Request, res: Response): Promise<void> {
    const { sourceConstellation, dataToTransfer, location } = req.body;

    // Find best target constellation
    const target = this.constellationFederation.findBestTarget(
      sourceConstellation,
      dataToTransfer,
      location
    );

    if (!target) {
      res.status(404).json({ error: "No suitable target found" });
      return;
    }

    res.status(200).json({
      recommendedTarget: target.constellationId,
      operator: target.operator,
      satCount: target.satelliteCount,
    });
  }

  private async handleFederationStatus(req: Request, res: Response): Promise<void> {
    const federationStatus = this.constellationFederation.getFederationStatus();
    const networkStatus = this.stationManager.getNetworkStatus();

    res.status(200).json({
      federation: federationStatus,
      groundNetwork: networkStatus,
      timestamp: new Date().toISOString(),
    });
  }

  private async handleHealthCheck(req: Request, res: Response): Promise<void> {
    res.status(200).json({
      status: "healthy",
      service: "federation-hub",
      uptime: process.uptime(),
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

  private initializeSampleData(): void {
    // Register sample ground stations
    const northAmericaStation: GroundStationConfig = {
      stationId: "GS-NA-001",
      name: "North America Primary",
      latitude: 40.8,
      longitude: -77.9,
      elevation: 150,
      region: "north-america",
      timezone: "America/New_York",
      antennaGainDbi: 48,
      transmitPowerW: 1000,
      receiveSensitivityDbm: -145,
      maxElevationAngle: 90,
      minElevationAngle: 5,
      operatingFrequenciesGhz: [2.2, 8.4],
      capabilities: ["telemetry", "command", "tracking"],
      redundantStations: ["GS-NA-002"],
    };

    const europeStation: GroundStationConfig = {
      stationId: "GS-EU-001",
      name: "Europe Primary",
      latitude: 51.5,
      longitude: 0,
      elevation: 50,
      region: "europe",
      timezone: "UTC",
      antennaGainDbi: 50,
      transmitPowerW: 2000,
      receiveSensitivityDbm: -147,
      maxElevationAngle: 90,
      minElevationAngle: 5,
      operatingFrequenciesGhz: [2.2, 8.4],
      capabilities: ["telemetry", "command", "tracking"],
      redundantStations: ["GS-EU-002"],
    };

    this.stationManager.registerStation(northAmericaStation);
    this.stationManager.registerStation(europeStation);
  }

  async start(port: number = 3005): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server.listen(port, () => {
          this.logger.info(`Federation Hub listening on port ${port}`);
          resolve();
        });
      } catch (error) {
        this.logger.error(error);
        reject(error);
      }
    });
  }

  async shutdown(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => {
        this.logger.info("Federation Hub shut down gracefully");
        resolve();
      });
    });
  }
}

const service = new FederationHubService();
service.start(3005).catch((error) => {
  console.error("Failed to start Federation Hub:", error);
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

export { FederationHubService };
