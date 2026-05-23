/**
 * Space Traffic Coordination System
 *
 * Multi-constellation traffic management:
 * - Orbital slot allocation
 * - Maneuver coordination
 * - Communication protocols
 * - Congestion prediction
 * - Inter-constellation traffic rules
 */

import pino from "pino";

/**
 * Orbital region definition
 */
export interface OrbitalRegion {
  regionId: string;
  altitude: number; // km
  inclination: number; // degrees
  eccentricity: number;
  capacity: number; // Max satellites
  currentOccupancy: number;
  congestionLevel: number; // 0-1
  restrictedUse: boolean;
  owningConstellation?: string;
}

/**
 * Traffic rule
 */
export interface TrafficRule {
  ruleId: string;
  ruleName: string;
  priority: "low" | "medium" | "high" | "critical";
  description: string;
  applicableRegions: string[];
  applicableConstellations: string[];
  constraint: string; // e.g., "max_satellites_per_region", "minimum_separation"
  value: number;
  enforced: boolean;
}

/**
 * Maneuver coordination request
 */
export interface ManeuverCoordinationRequest {
  requestId: string;
  initiatingConstellation: string;
  affectedConstellation?: string;
  satellite: string;
  deltaV: { x: number; y: number; z: number };
  burnTime: number;
  estimatedDuration: number;
  priority: "low" | "medium" | "high" | "emergency";
  reason: string;
  status: "submitted" | "approved" | "denied" | "cancelled";
  responseTime?: number;
}

/**
 * Traffic forecast
 */
export interface TrafficForecast {
  forecastId: string;
  regionId: string;
  forecastTime: number; // Time in future for forecast
  predictedOccupancy: number;
  predictedCongestion: number; // 0-1
  expectedManeuvers: number;
  potentialConjunctions: number;
  risksIdentified: string[];
}

/**
 * Inter-constellation communication message
 */
export interface CoordinationMessage {
  messageId: string;
  sender: string;
  recipient: string;
  messageType: "query" | "notification" | "request" | "response" | "alert";
  content: Record<string, any>;
  priority: "low" | "medium" | "high" | "critical";
  timestamp: number;
  acknowledged: boolean;
  responseRequired: boolean;
}

/**
 * Space Traffic Coordinator
 */
export class SpaceTrafficCoordinator {
  private logger = pino();
  private regions: Map<string, OrbitalRegion>;
  private rules: Map<string, TrafficRule>;
  private maneuverRequests: Map<string, ManeuverCoordinationRequest>;
  private messageLog: CoordinationMessage[];
  private constellationProfiles: Map<
    string,
    {
      name: string;
      satelliteCount: number;
      orbitalRegions: string[];
      coordinator: string;
      lastUpdate: number;
    }
  >;

  constructor() {
    this.regions = new Map();
    this.rules = new Map();
    this.maneuverRequests = new Map();
    this.messageLog = [];
    this.constellationProfiles = new Map();

    this.initializeDefaultRegions();
    this.initializeDefaultRules();
  }

  /**
   * Initialize standard orbital regions
   */
  private initializeDefaultRegions(): void {
    const standardRegions: OrbitalRegion[] = [
      {
        regionId: "LEO-400-500",
        altitude: 450,
        inclination: 0,
        eccentricity: 0.001,
        capacity: 1000,
        currentOccupancy: 0,
        congestionLevel: 0,
        restrictedUse: false,
      },
      {
        regionId: "LEO-500-600",
        altitude: 550,
        inclination: 51.6,
        eccentricity: 0.001,
        capacity: 2000,
        currentOccupancy: 0,
        congestionLevel: 0,
        restrictedUse: false,
      },
      {
        regionId: "MEO-8000-10000",
        altitude: 9000,
        inclination: 55,
        eccentricity: 0.1,
        capacity: 500,
        currentOccupancy: 0,
        congestionLevel: 0,
        restrictedUse: false,
      },
      {
        regionId: "GEO-35786",
        altitude: 35786,
        inclination: 0,
        eccentricity: 0.0001,
        capacity: 360,
        currentOccupancy: 0,
        congestionLevel: 0,
        restrictedUse: true,
        owningConstellation: "INTELSAT/EUTELSAT/ARABSAT",
      },
    ];

    for (const region of standardRegions) {
      this.regions.set(region.regionId, region);
    }

    this.logger.info(
      { regionCount: standardRegions.length },
      "Orbital regions initialized"
    );
  }

  /**
   * Initialize traffic rules
   */
  private initializeDefaultRules(): void {
    const defaultRules: TrafficRule[] = [
      {
        ruleId: "RULE-001",
        ruleName: "Minimum Separation",
        priority: "critical",
        description: "Minimum 1 km separation between active satellites",
        applicableRegions: [],
        applicableConstellations: [],
        constraint: "minimum_separation_km",
        value: 1.0,
        enforced: true,
      },
      {
        ruleId: "RULE-002",
        ruleName: "Regional Capacity",
        priority: "high",
        description: "No more than region capacity",
        applicableRegions: [],
        applicableConstellations: [],
        constraint: "max_satellites_per_region",
        value: 1.0, // 100% multiplier
        enforced: true,
      },
      {
        ruleId: "RULE-003",
        ruleName: "Debris Avoidance",
        priority: "critical",
        description: "Avoid known debris with safety margin",
        applicableRegions: [],
        applicableConstellations: [],
        constraint: "debris_safety_margin_km",
        value: 10.0, // 10 km buffer
        enforced: true,
      },
      {
        ruleId: "RULE-004",
        ruleName: "Maneuver Notification",
        priority: "high",
        description: "Notify other constellations of planned maneuvers",
        applicableRegions: [],
        applicableConstellations: [],
        constraint: "maneuver_notification_hours",
        value: 24.0, // 24 hours notice
        enforced: true,
      },
      {
        ruleId: "RULE-005",
        ruleName: "Congestion Threshold",
        priority: "medium",
        description: "Limit maneuvers when region congestion > 80%",
        applicableRegions: [],
        applicableConstellations: [],
        constraint: "congestion_threshold",
        value: 0.8,
        enforced: true,
      },
    ];

    for (const rule of defaultRules) {
      this.rules.set(rule.ruleId, rule);
    }

    this.logger.info(
      { ruleCount: defaultRules.length },
      "Traffic rules initialized"
    );
  }

  /**
   * Register constellation
   */
  registerConstellation(
    constellationId: string,
    name: string,
    satelliteCount: number,
    orbitalRegions: string[],
    coordinatorId: string
  ): void {
    this.constellationProfiles.set(constellationId, {
      name,
      satelliteCount,
      orbitalRegions,
      coordinator: coordinatorId,
      lastUpdate: Date.now(),
    });

    // Update region occupancy
    for (const regionId of orbitalRegions) {
      const region = this.regions.get(regionId);
      if (region) {
        region.currentOccupancy = Math.min(
          region.capacity,
          region.currentOccupancy + satelliteCount
        );
        region.congestionLevel = region.currentOccupancy / region.capacity;
      }
    }

    this.logger.info(
      { constellationId, name, satelliteCount },
      "Constellation registered"
    );
  }

  /**
   * Request maneuver coordination
   */
  requestManeuverCoordination(
    initiatingConstellation: string,
    satellite: string,
    deltaV: { x: number; y: number; z: number },
    burnTime: number,
    estimatedDuration: number,
    priority: "low" | "medium" | "high" | "emergency" = "medium",
    reason: string = "Routine maintenance"
  ): ManeuverCoordinationRequest {
    const requestId = `MANREQ-${Date.now()}`;

    const request: ManeuverCoordinationRequest = {
      requestId,
      initiatingConstellation,
      satellite,
      deltaV,
      burnTime,
      estimatedDuration,
      priority,
      reason,
      status: "submitted",
    };

    // Check against rules
    const rulesViolations = this.checkRuleCompliance(request);

    if (rulesViolations.length === 0) {
      request.status = "approved";
    } else {
      request.status = "denied";
      this.logger.warn(
        {
          requestId,
          violations: rulesViolations,
        },
        "Maneuver request denied"
      );
    }

    this.maneuverRequests.set(requestId, request);

    // Notify affected constellations
    if (request.status === "approved") {
      this.notifyAffectedConstellations(request);
    }

    return request;
  }

  /**
   * Check request against traffic rules
   */
  private checkRuleCompliance(request: ManeuverCoordinationRequest): string[] {
    const violations: string[] = [];

    // Rule 004: Maneuver notification (check if enough notice)
    const noticeRule = this.rules.get("RULE-004");
    if (noticeRule && noticeRule.enforced) {
      const hoursUntilBurn = (request.burnTime - Date.now()) / 3600000;
      if (hoursUntilBurn < noticeRule.value) {
        violations.push(
          `Insufficient notice: ${hoursUntilBurn.toFixed(1)} hours, required ${noticeRule.value}`
        );
      }
    }

    // Rule 005: Congestion check
    const congestionRule = this.rules.get("RULE-005");
    if (congestionRule && congestionRule.enforced) {
      const constellation = this.constellationProfiles.get(
        request.initiatingConstellation
      );
      if (constellation) {
        for (const regionId of constellation.orbitalRegions) {
          const region = this.regions.get(regionId);
          if (
            region &&
            region.congestionLevel > congestionRule.value &&
            request.priority === "low"
          ) {
            violations.push(
              `Region ${regionId} congestion too high: ${(region.congestionLevel * 100).toFixed(1)}%`
            );
          }
        }
      }
    }

    return violations;
  }

  /**
   * Notify other constellations of maneuver
   */
  private notifyAffectedConstellations(
    request: ManeuverCoordinationRequest
  ): void {
    for (const [constellationId, profile] of this.constellationProfiles) {
      if (constellationId === request.initiatingConstellation) continue;

      const message: CoordinationMessage = {
        messageId: `MSG-${Date.now()}`,
        sender: request.initiatingConstellation,
        recipient: constellationId,
        messageType: "notification",
        content: {
          notificationType: "maneuver_notification",
          satellite: request.satellite,
          burnTime: request.burnTime,
          deltaV: request.deltaV,
          reason: request.reason,
        },
        priority: request.priority === "emergency" ? "critical" : "high",
        timestamp: Date.now(),
        acknowledged: false,
        responseRequired: false,
      };

      this.messageLog.push(message);
    }
  }

  /**
   * Send coordination message
   */
  sendMessage(
    sender: string,
    recipient: string,
    messageType: "query" | "notification" | "request" | "response" | "alert",
    content: Record<string, any>,
    priority: "low" | "medium" | "high" | "critical" = "medium",
    responseRequired: boolean = false
  ): CoordinationMessage {
    const message: CoordinationMessage = {
      messageId: `MSG-${Date.now()}`,
      sender,
      recipient,
      messageType,
      content,
      priority,
      timestamp: Date.now(),
      acknowledged: false,
      responseRequired,
    };

    this.messageLog.push(message);

    this.logger.info(
      {
        messageId: message.messageId,
        sender,
        recipient,
        type: messageType,
        priority,
      },
      "Message sent"
    );

    return message;
  }

  /**
   * Acknowledge message
   */
  acknowledgeMessage(messageId: string): boolean {
    // Find message in log
    const message = this.messageLog.find((m) => m.messageId === messageId);
    if (!message) {
      return false;
    }

    message.acknowledged = true;
    return true;
  }

  /**
   * Forecast traffic in region
   */
  forecastRegionTraffic(
    regionId: string,
    hoursAhead: number = 24
  ): TrafficForecast {
    const region = this.regions.get(regionId);
    if (!region) {
      throw new Error(`Region ${regionId} not found`);
    }

    // Predict future occupancy (simplified)
    const expectedNewSatellites = 2; // Expected new deployments
    const expectedManeuvers = 5; // Expected maneuvers in timeframe
    const expectedConjunctions = 1;

    const predictedOccupancy = Math.min(
      region.capacity,
      region.currentOccupancy + expectedNewSatellites
    );
    const predictedCongestion = predictedOccupancy / region.capacity;

    const risks: string[] = [];
    if (predictedCongestion > 0.8) {
      risks.push("High congestion expected");
    }
    if (expectedConjunctions > 2) {
      risks.push("Multiple conjunctions possible");
    }
    if (expectedManeuvers > 10) {
      risks.push("High maneuver activity");
    }

    return {
      forecastId: `FORECAST-${Date.now()}`,
      regionId,
      forecastTime: Date.now() + hoursAhead * 3600000,
      predictedOccupancy,
      predictedCongestion,
      expectedManeuvers,
      potentialConjunctions: expectedConjunctions,
      risksIdentified: risks,
    };
  }

  /**
   * Get orbital region info
   */
  getRegion(regionId: string): OrbitalRegion | undefined {
    return this.regions.get(regionId);
  }

  /**
   * Get all regions
   */
  getAllRegions(): OrbitalRegion[] {
    return Array.from(this.regions.values());
  }

  /**
   * Get constellation profile
   */
  getConstellationProfile(constellationId: string):
    | {
        name: string;
        satelliteCount: number;
        orbitalRegions: string[];
        coordinator: string;
        lastUpdate: number;
      }
    | undefined {
    return this.constellationProfiles.get(constellationId);
  }

  /**
   * Get high-priority messages
   */
  getHighPriorityMessages(since?: number):CoordinationMessage[] {
    return this.messageLog.filter((m) => {
      if (m.priority !== "critical" && m.priority !== "high") return false;
      if (since && m.timestamp < since) return false;
      return !m.acknowledged;
    });
  }

  /**
   * Get system statistics
   */
  getStatistics(): {
    registeredConstellations: number;
    totalSatellites: number;
    orbitalRegions: number;
    averageCongestion: number;
    activeRules: number;
    pendingManeuverRequests: number;
    unacknowledgedMessages: number;
  } {
    let totalSatellites = 0;
    for (const profile of this.constellationProfiles.values()) {
      totalSatellites += profile.satelliteCount;
    }

    const regionArray = Array.from(this.regions.values());
    const avgCongestion =
      regionArray.length > 0
        ? regionArray.reduce((sum, r) => sum + r.congestionLevel, 0) /
          regionArray.length
        : 0;

    const pendingRequests = Array.from(this.maneuverRequests.values()).filter(
      (r) => r.status === "submitted"
    ).length;

    const unacknowledged = this.messageLog.filter(
      (m) => !m.acknowledged && m.responseRequired
    ).length;

    return {
      registeredConstellations: this.constellationProfiles.size,
      totalSatellites,
      orbitalRegions: this.regions.size,
      averageCongestion: avgCongestion,
      activeRules: Array.from(this.rules.values()).filter((r) => r.enforced)
        .length,
      pendingManeuverRequests: pendingRequests,
      unacknowledgedMessages: unacknowledged,
    };
  }
}

export default SpaceTrafficCoordinator;
