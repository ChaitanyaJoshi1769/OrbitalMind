/**
 * OrbitalMind Orbital Physics Simulator
 * High-fidelity simulation of satellite orbits, thermal dynamics, and networks
 */

import {
  OrbitalElements,
  StateVector,
  calculateOrbitalPeriod,
  calculateMeanMotion,
  propagateOrbit,
  orbitalElementsToStateVector,
  stateVectorToGeographic,
  calculateEclipseDuration,
  createSatelliteID,
  SatelliteID
} from '@orbitalmind/shared';

export interface SimulationConfig {
  timeStep: number;           // seconds
  simulationDuration: number; // seconds
  recordTelemetry: boolean;
  includeSolarRadiation: boolean;
  includeAeroDrag: boolean;
  includeGravityPerturbations: boolean;
}

export interface ConstellationConfig {
  satelliteCount: number;
  orbitalPlanes: number;
  semiMajorAxis: number;      // km
  inclination: number;         // degrees
  eccentricity: number;
}

export interface ThermalSimulationState {
  satelliteID: SatelliteID;
  junctionTemp: number;
  caseTemp: number;
  radiatorTemp: number;
  currentPower: number;
  timestamp: Date;
}

/**
 * Orbital physics simulator for constellation analysis
 */
export class OrbitalSimulator {
  private satellites: Map<SatelliteID, OrbitalElements> = new Map();
  private stateVectors: Map<SatelliteID, StateVector> = new Map();
  private config: SimulationConfig;
  private currentTime: Date;
  private simTime: number = 0;  // seconds

  constructor(config: SimulationConfig) {
    this.config = config;
    this.currentTime = new Date();
  }

  /**
   * Create initial constellation
   */
  public createConstellation(constellationConfig: ConstellationConfig): void {
    this.satellites.clear();
    this.stateVectors.clear();

    const satsPerPlane = Math.ceil(constellationConfig.satelliteCount / constellationConfig.orbitalPlanes);
    let satIndex = 0;

    for (let plane = 0; plane < constellationConfig.orbitalPlanes; plane++) {
      for (let slot = 0; slot < satsPerPlane && satIndex < constellationConfig.satelliteCount; slot++) {
        const satelliteID = createSatelliteID(`SAT-${plane}-${slot}`);

        const elements: OrbitalElements = {
          semiMajorAxis: constellationConfig.semiMajorAxis,
          eccentricity: constellationConfig.eccentricity,
          inclination: constellationConfig.inclination,
          argumentOfPerigee: 0,
          rightAscension: (plane * 360 / constellationConfig.orbitalPlanes) % 360,
          meanAnomaly: (slot * 360 / satsPerPlane) % 360
        };

        this.satellites.set(satelliteID, elements);
        
        const stateVector = orbitalElementsToStateVector(elements, this.currentTime);
        this.stateVectors.set(satelliteID, stateVector);

        satIndex++;
      }
    }
  }

  /**
   * Step simulation forward
   */
  public step(): void {
    this.simTime += this.config.timeStep;
    const newTime = new Date(this.currentTime.getTime() + this.config.timeStep * 1000);

    for (const [satID, elements] of this.satellites) {
      const propagatedElements = propagateOrbit(elements, this.config.timeStep);
      this.satellites.set(satID, propagatedElements);

      const stateVector = orbitalElementsToStateVector(propagatedElements, newTime);
      this.stateVectors.set(satID, stateVector);
    }

    this.currentTime = newTime;
  }

  /**
   * Get satellite position in geographic coordinates
   */
  public getSatellitePosition(satelliteID: SatelliteID) {
    const stateVector = this.stateVectors.get(satelliteID);
    if (!stateVector) return null;

    return stateVectorToGeographic(stateVector);
  }

  /**
   * Get distance between two satellites
   */
  public getInterSatelliteDistance(sat1: SatelliteID, sat2: SatelliteID): number {
    const state1 = this.stateVectors.get(sat1);
    const state2 = this.stateVectors.get(sat2);

    if (!state1 || !state2) return Infinity;

    const dx = state2.position.x - state1.position.x;
    const dy = state2.position.y - state1.position.y;
    const dz = state2.position.z - state1.position.z;

    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Determine if two satellites are in line-of-sight
   */
  public isLineOfSight(sat1: SatelliteID, sat2: SatelliteID, earthRadius: number = 6371): boolean {
    const state1 = this.stateVectors.get(sat1);
    const state2 = this.stateVectors.get(sat2);

    if (!state1 || !state2) return false;

    const pos1 = state1.position;
    const pos2 = state2.position;

    // Vector from satellite 1 to satellite 2
    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    const dz = pos2.z - pos1.z;

    // Closest point on line segment to Earth center
    const t = Math.max(0, Math.min(1, 
      -(pos1.x * dx + pos1.y * dy + pos1.z * dz) / (dx * dx + dy * dy + dz * dz)
    ));

    const closestX = pos1.x + t * dx;
    const closestY = pos1.y + t * dy;
    const closestZ = pos1.z + t * dz;

    const distanceToEarth = Math.sqrt(closestX * closestX + closestY * closestY + closestZ * closestZ);

    return distanceToEarth > earthRadius;
  }

  /**
   * Get all inter-satellite links
   */
  public computeInterSatelliteLinks(maxDistance: number = 1000): Array<{from: SatelliteID; to: SatelliteID; distance: number}> {
    const links: Array<{from: SatelliteID; to: SatelliteID; distance: number}> = [];
    const sats = Array.from(this.satellites.keys());

    for (let i = 0; i < sats.length; i++) {
      for (let j = i + 1; j < sats.length; j++) {
        const distance = this.getInterSatelliteDistance(sats[i], sats[j]);
        if (distance < maxDistance && this.isLineOfSight(sats[i], sats[j])) {
          links.push({
            from: sats[i],
            to: sats[j],
            distance
          });
        }
      }
    }

    return links;
  }

  /**
   * Get current simulation time
   */
  public getSimulationTime(): { realTime: Date; elapsed: number } {
    return {
      realTime: this.currentTime,
      elapsed: this.simTime
    };
  }

  /**
   * Get all satellites
   */
  public getAllSatellites(): SatelliteID[] {
    return Array.from(this.satellites.keys());
  }
}

/**
 * Thermal dynamics simulator
 */
export class ThermalSimulator {
  private thermalStates: Map<SatelliteID, ThermalSimulationState> = new Map();
  private timeConstant: number = 45;  // seconds
  private ambientTemp: number = 20;   // °C

  /**
   * Initialize satellite thermal state
   */
  public initializeSatellite(satelliteID: SatelliteID, initialTemp: number = 25): void {
    this.thermalStates.set(satelliteID, {
      satelliteID,
      junctionTemp: initialTemp,
      caseTemp: initialTemp,
      radiatorTemp: initialTemp - 5,
      currentPower: 0,
      timestamp: new Date()
    });
  }

  /**
   * Update power dissipation
   */
  public setPowerDissipation(satelliteID: SatelliteID, powerWatts: number): void {
    const state = this.thermalStates.get(satelliteID);
    if (state) {
      state.currentPower = powerWatts;
    }
  }

  /**
   * Step thermal simulation
   */
  public step(deltaTime: number, solarIntensity: number = 1.0): void {
    for (const [satID, state] of this.thermalStates) {
      // Exponential heat equation: T(t) = T_amb + (P*R_th) * (1 - exp(-t/tau))
      const heatGenerated = state.currentPower + solarIntensity * 0.5;  // Solar + internal
      const steadyStateTemp = this.ambientTemp + heatGenerated * 10;    // Simplified R_th = 10 °C/W

      // Exponential approach to steady state
      const decayFactor = Math.exp(-deltaTime / this.timeConstant);
      state.junctionTemp = steadyStateTemp + (state.junctionTemp - steadyStateTemp) * decayFactor;
      
      // Case temperature follows junction with lag
      state.caseTemp = state.caseTemp * 0.95 + state.junctionTemp * 0.05;
      
      // Radiator temperature (always cooler)
      state.radiatorTemp = state.caseTemp - 5 + Math.random() * 2;  // Small variation

      state.timestamp = new Date();
    }
  }

  /**
   * Get thermal state
   */
  public getThermalState(satelliteID: SatelliteID): ThermalSimulationState | null {
    return this.thermalStates.get(satelliteID) ?? null;
  }

  /**
   * Get average constellation temperature
   */
  public getAverageTemperature(): number {
    if (this.thermalStates.size === 0) return this.ambientTemp;

    let sum = 0;
    for (const state of this.thermalStates.values()) {
      sum += state.junctionTemp;
    }

    return sum / this.thermalStates.size;
  }
}

/**
 * Network topology simulator
 */
export class NetworkSimulator {
  private orbitalSim: OrbitalSimulator;
  private linkUpdateInterval: number = 1;  // seconds

  constructor(orbitalSim: OrbitalSimulator) {
    this.orbitalSim = orbitalSim;
  }

  /**
   * Compute current network topology
   */
  public computeTopology(maxLinkDistance: number = 1000) {
    const links = this.orbitalSim.computeInterSatelliteLinks(maxLinkDistance);
    
    return {
      totalSatellites: this.orbitalSim.getAllSatellites().length,
      activeLinks: links.length,
      averageLinkDistance: links.length > 0 ? 
        links.reduce((sum, l) => sum + l.distance, 0) / links.length : 0,
      links
    };
  }

  /**
   * Estimate link quality based on distance and doppler
   */
  public estimateLinkQuality(distance: number): { bandwidth: number; latency: number; reliability: number } {
    // Simplified model: bandwidth decreases with distance
    const bandwidth = Math.max(10, 100 - distance / 20);
    const latency = distance / 300000;  // Speed of light delay in seconds
    const reliability = Math.max(50, 100 - distance / 10);  // Quality degrades with distance

    return {
      bandwidth,
      latency: latency * 1000,  // Convert to ms
      reliability
    };
  }
}
