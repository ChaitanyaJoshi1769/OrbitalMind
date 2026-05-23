/**
 * Ground Station Network Management
 * 
 * Coordinates multiple ground stations across regions
 * Manages contact windows, visibility, and handoffs
 */

import pino from "pino";

export interface GroundStationConfig {
  stationId: string;
  name: string;
  latitude: number;
  longitude: number;
  elevation: number; // meters
  region: string;
  timezone: string;
  antennaGainDbi: number;
  transmitPowerW: number;
  receiveSensitivityDbm: number;
  maxElevationAngle: number;
  minElevationAngle: number; // typically 5-10 degrees
  operatingFrequenciesGhz: number[];
  capabilities: string[]; // "telemetry", "command", "tracking", etc
  redundantStations: string[]; // IDs of backup stations
}

export interface SatellitePass {
  satelliteId: string;
  stationId: string;
  riseTime: number; // Unix timestamp
  culminationTime: number;
  setTime: number;
  maxElevation: number; // degrees
  passQuality: number; // 0-1
  signalQuality: number; // Expected SNR indicator
  duration: number; // milliseconds
}

export interface ContactWindow {
  satelliteId: string;
  stationId: string;
  startTime: number;
  endTime: number;
  type: "downlink" | "uplink" | "bidirectional";
  priority: number; // 1-5, higher = more important
  dataVolume: number; // bytes
  commandCount: number;
}

export interface StationNetworkState {
  stations: Map<string, GroundStationConfig>;
  activeContacts: Map<string, ContactWindow>;
  upcomingPasses: SatellitePass[];
  regionStatus: Record<string, RegionStatus>;
}

interface RegionStatus {
  regionId: string;
  stationCount: number;
  activeContacts: number;
  coverage: number; // percentage
  readiness: number; // 0-1
}

/**
 * Ground Station Manager
 * Centralized coordination of all ground stations
 */
export class GroundStationManager {
  private stations: Map<string, GroundStationConfig>;
  private contacts: Map<string, ContactWindow>;
  private passes: Map<string, SatellitePass[]>;
  private logger = pino();
  private regionStats: Map<string, RegionStatus>;

  constructor() {
    this.stations = new Map();
    this.contacts = new Map();
    this.passes = new Map();
    this.regionStats = new Map();
  }

  /**
   * Register a ground station
   */
  registerStation(config: GroundStationConfig): void {
    this.stations.set(config.stationId, config);
    this.logger.info(
      { stationId: config.stationId, region: config.region },
      "Ground station registered"
    );

    // Update region stats
    this.updateRegionStats(config.region);
  }

  /**
   * Get station by ID
   */
  getStation(stationId: string): GroundStationConfig | undefined {
    return this.stations.get(stationId);
  }

  /**
   * Get all stations in a region
   */
  getStationsByRegion(region: string): GroundStationConfig[] {
    return Array.from(this.stations.values()).filter(
      (s) => s.region === region
    );
  }

  /**
   * Calculate visibility window between satellite and ground station
   * Uses spherical trigonometry for accurate calculation
   */
  calculateVisibilityWindow(
    satelliteId: string,
    stationId: string,
    currentTime: number,
    horizon: number = 0 // degrees above horizon
  ): SatellitePass | null {
    const station = this.stations.get(stationId);
    if (!station) return null;

    // Simplified orbital mechanics calculation
    // In production: use SGP4 propagation model
    
    // Assume satellite in circular orbit (400 km altitude)
    const satAltitude = 400; // km
    const earthRadius = 6371; // km

    // Maximum slant range
    const maxRange = Math.sqrt(
      (earthRadius + satAltitude) ** 2 -
        earthRadius ** 2 * Math.cos(Math.radians(horizon))
    );

    // Contact duration estimation
    // Simplified: ~10 minutes average pass
    const orbitPeriod = 90; // minutes
    const passVisibility = 10; // minutes
    const passDurationMs = passVisibility * 60 * 1000;

    // Simplified pass times
    const riseTime = currentTime + 3600 * 1000; // 1 hour from now
    const culminationTime = riseTime + passDurationMs / 3;
    const setTime = riseTime + passDurationMs;

    // Calculate pass quality based on elevation
    const maxElevation = this.calculateMaxElevation(
      station,
      satAltitude,
      earthRadius
    );
    const passQuality = Math.min(1, (maxElevation - horizon) / 80); // Normalize to 0-1

    // Signal quality (SNR indicator)
    const signalQuality = this.estimateSignalQuality(
      station,
      maxElevation,
      satAltitude
    );

    return {
      satelliteId,
      stationId,
      riseTime,
      culminationTime,
      setTime,
      maxElevation,
      passQuality,
      signalQuality,
      duration: passDurationMs,
    };
  }

  /**
   * Schedule contact window
   */
  scheduleContact(
    satelliteId: string,
    stationId: string,
    startTime: number,
    endTime: number,
    type: "downlink" | "uplink" | "bidirectional",
    priority: number = 3,
    dataVolume: number = 0,
    commandCount: number = 0
  ): string {
    const contactId = `${satelliteId}-${stationId}-${Date.now()}`;

    const contact: ContactWindow = {
      satelliteId,
      stationId,
      startTime,
      endTime,
      type,
      priority,
      dataVolume,
      commandCount,
    };

    this.contacts.set(contactId, contact);

    this.logger.info(
      { contactId, satelliteId, stationId },
      "Contact window scheduled"
    );

    return contactId;
  }

  /**
   * Get active contacts
   */
  getActiveContacts(): ContactWindow[] {
    const now = Date.now();
    return Array.from(this.contacts.values()).filter(
      (c) => c.startTime <= now && c.endTime >= now
    );
  }

  /**
   * Get contacts for satellite
   */
  getContactsForSatellite(satelliteId: string): ContactWindow[] {
    return Array.from(this.contacts.values()).filter(
      (c) => c.satelliteId === satelliteId
    );
  }

  /**
   * Get next available station for satellite
   * Prioritizes by:
   * 1. Contact window availability
   * 2. Signal quality
   * 3. Redundancy (avoid single point of failure)
   */
  selectNextStation(
    satelliteId: string,
    fromRegion?: string
  ): GroundStationConfig | null {
    let candidates = Array.from(this.stations.values());

    // Filter by region if specified
    if (fromRegion) {
      candidates = candidates.filter((s) => s.region === fromRegion);
    }

    // Score candidates based on available contact windows
    const scored = candidates.map((station) => {
      const pass = this.calculateVisibilityWindow(
        satelliteId,
        station.stationId,
        Date.now()
      );

      const score = pass ? pass.passQuality * pass.signalQuality : 0;

      return { station, score, pass };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    return scored.length > 0 ? scored[0].station : null;
  }

  /**
   * Get network status
   */
  getNetworkStatus(): {
    totalStations: number;
    totalContacts: number;
    activeContacts: number;
    regions: RegionStatus[];
    coverage: number; // global coverage percentage
  } {
    const activeContacts = this.getActiveContacts();
    const regions = Array.from(this.regionStats.values());

    // Calculate global coverage
    const totalCapacity = Array.from(this.stations.values()).length;
    const coverage =
      totalCapacity > 0
        ? (Array.from(this.regionStats.values()).reduce(
            (sum, r) => sum + r.coverage,
            0
          ) /
            this.regionStats.size) * 100
        : 0;

    return {
      totalStations: this.stations.size,
      totalContacts: this.contacts.size,
      activeContacts: activeContacts.length,
      regions,
      coverage,
    };
  }

  /**
   * Private helper: Calculate maximum elevation angle
   */
  private calculateMaxElevation(
    station: GroundStationConfig,
    satAltitude: number,
    earthRadius: number
  ): number {
    // Simplified: assume satellite directly overhead on equator
    // Real calculation uses satellite position vector
    const angle = 90; // degrees - simplified to max possible
    return Math.min(angle, station.maxElevationAngle);
  }

  /**
   * Private helper: Estimate signal quality
   */
  private estimateSignalQuality(
    station: GroundStationConfig,
    elevation: number,
    satAltitude: number
  ): number {
    // Signal quality improves with:
    // - Higher elevation
    // - Better antenna gain
    // - Lower altitude (closer satellite)

    const elevationFactor = Math.max(0, elevation / 90);
    const antennaFactor = Math.min(1, station.antennaGainDbi / 50);
    const altitudeFactor = Math.max(0, 1 - satAltitude / 1000);

    return (elevationFactor * 0.5 + antennaFactor * 0.3 + altitudeFactor * 0.2);
  }

  /**
   * Update region statistics
   */
  private updateRegionStats(region: string): void {
    const stationsInRegion = this.getStationsByRegion(region);
    const activeContactsInRegion = Array.from(this.contacts.values()).filter(
      (c) =>
        this.stations.get(c.stationId)?.region === region &&
        c.startTime <= Date.now() &&
        c.endTime >= Date.now()
    );

    const status: RegionStatus = {
      regionId: region,
      stationCount: stationsInRegion.length,
      activeContacts: activeContactsInRegion.length,
      coverage: Math.min(100, stationsInRegion.length * 20), // Rough estimate
      readiness: Math.min(1, stationsInRegion.length / 3), // Full readiness at 3+ stations
    };

    this.regionStats.set(region, status);
  }

  /**
   * Helper: Radians conversion
   */
  private static radians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}

// Make static method accessible
Math.radians = (degrees: number): number => degrees * (Math.PI / 180);
