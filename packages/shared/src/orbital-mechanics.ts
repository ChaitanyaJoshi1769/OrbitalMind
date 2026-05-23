/**
 * Orbital Mechanics and Physics Utilities
 * Based on classical orbital mechanics (Keplerian)
 */

export interface OrbitalElements {
  semiMajorAxis: number;      // km
  eccentricity: number;       // 0-1
  inclination: number;        // degrees
  argumentOfPerigee: number;  // degrees
  rightAscension: number;     // degrees (RAAN)
  meanAnomaly: number;        // degrees
}

export interface StateVector {
  position: { x: number; y: number; z: number };  // km (ECI)
  velocity: { x: number; y: number; z: number };  // km/s (ECI)
  time: Date;
}

const MU = 398600.4418;  // km³/s² (Earth's standard gravitational parameter)
const EARTH_RADIUS = 6371.0;  // km

/**
 * Calculate orbital period using Kepler's third law
 * T = 2π * sqrt(a³/μ)
 */
export function calculateOrbitalPeriod(semiMajorAxis: number): number {
  return 2 * Math.PI * Math.sqrt(Math.pow(semiMajorAxis, 3) / MU);
}

/**
 * Calculate mean motion (rad/s)
 */
export function calculateMeanMotion(semiMajorAxis: number): number {
  return Math.sqrt(MU / Math.pow(semiMajorAxis, 3));
}

/**
 * Solve Kepler's equation using Newton-Raphson method
 * Returns eccentric anomaly (radians)
 */
export function solveKeplersEquation(meanAnomaly: number, eccentricity: number, tolerance: number = 1e-6): number {
  let M = meanAnomaly % (2 * Math.PI);
  if (M < 0) M += 2 * Math.PI;

  let E = M;
  if (eccentricity > 0.8) {
    E = Math.PI;
  }

  for (let i = 0; i < 100; i++) {
    const dE = (M + eccentricity * Math.sin(E) - E) / (1 - eccentricity * Math.cos(E));
    E += dE;
    if (Math.abs(dE) < tolerance) break;
  }

  return E;
}

/**
 * Convert orbital elements to state vector
 */
export function orbitalElementsToStateVector(elements: OrbitalElements, time: Date): StateVector {
  const E = solveKeplersEquation(elements.meanAnomaly * Math.PI / 180, elements.eccentricity);

  // True anomaly
  const cosE = Math.cos(E);
  const sinE = Math.sin(E);
  const trueAnomaly = 2 * Math.atan2(
    Math.sqrt(1 + elements.eccentricity) * sinE,
    Math.sqrt(1 - elements.eccentricity) * cosE
  );

  // Distance from central body
  const r = elements.semiMajorAxis * (1 - elements.eccentricity * cosE);

  // Position in orbital plane
  const x_orb = r * Math.cos(trueAnomaly);
  const y_orb = r * Math.sin(trueAnomaly);
  const z_orb = 0;

  // Velocity in orbital plane
  const h = Math.sqrt(MU * elements.semiMajorAxis * (1 - Math.pow(elements.eccentricity, 2)));
  const vx_orb = -MU / h * Math.sin(trueAnomaly);
  const vy_orb = MU / h * (elements.eccentricity + Math.cos(trueAnomaly));
  const vz_orb = 0;

  // Rotate from orbital plane to ECI
  const omega = elements.rightAscension * Math.PI / 180;
  const i = elements.inclination * Math.PI / 180;
  const w = elements.argumentOfPerigee * Math.PI / 180;

  const cosOmega = Math.cos(omega);
  const sinOmega = Math.sin(omega);
  const cosI = Math.cos(i);
  const sinI = Math.sin(i);
  const cosW = Math.cos(w);
  const sinW = Math.sin(w);

  const x = (cosOmega * cosW - sinOmega * sinW * cosI) * x_orb +
            (-cosOmega * sinW - sinOmega * cosW * cosI) * y_orb;
  const y = (sinOmega * cosW + cosOmega * sinW * cosI) * x_orb +
            (-sinOmega * sinW + cosOmega * cosW * cosI) * y_orb;
  const z = sinW * sinI * x_orb + cosW * sinI * y_orb;

  const vx = (cosOmega * cosW - sinOmega * sinW * cosI) * vx_orb +
             (-cosOmega * sinW - sinOmega * cosW * cosI) * vy_orb;
  const vy = (sinOmega * cosW + cosOmega * sinW * cosI) * vx_orb +
             (-sinOmega * sinW + cosOmega * cosW * cosI) * vy_orb;
  const vz = sinW * sinI * vx_orb + cosW * sinI * vy_orb;

  return {
    position: { x, y, z },
    velocity: { vx, vy, vz },
    time
  };
}

/**
 * Convert state vector to orbital elements
 */
export function stateVectorToOrbitalElements(state: StateVector): OrbitalElements {
  const { x, y, z } = state.position;
  const { vx, vy, vz } = state.velocity;

  const r = Math.sqrt(x * x + y * y + z * z);
  const v = Math.sqrt(vx * vx + vy * vy + vz * vz);

  // Semi-major axis
  const semiMajorAxis = 1 / (2 / r - v * v / MU);

  // Eccentricity
  const h_vec = {
    x: y * vz - z * vy,
    y: z * vx - x * vz,
    z: x * vy - y * vx
  };
  const h = Math.sqrt(h_vec.x * h_vec.x + h_vec.y * h_vec.y + h_vec.z * h_vec.z);

  const e_vec = {
    x: (v * v / MU - 1 / r) * x - (x * vx + y * vy + z * vz) / MU * vx,
    y: (v * v / MU - 1 / r) * y - (x * vx + y * vy + z * vz) / MU * vy,
    z: (v * v / MU - 1 / r) * z - (x * vx + y * vy + z * vz) / MU * vz
  };
  const eccentricity = Math.sqrt(e_vec.x * e_vec.x + e_vec.y * e_vec.y + e_vec.z * e_vec.z);

  // Inclination
  const inclination = Math.acos(h_vec.z / h) * 180 / Math.PI;

  // Right ascension of ascending node
  const n_vec = { x: -h_vec.y, y: h_vec.x, z: 0 };
  const n = Math.sqrt(n_vec.x * n_vec.x + n_vec.y * n_vec.y);
  let rightAscension = Math.acos(n_vec.x / n) * 180 / Math.PI;
  if (n_vec.y < 0) rightAscension = 360 - rightAscension;

  // Argument of perigee
  let argumentOfPerigee = Math.acos((n_vec.x * e_vec.x + n_vec.y * e_vec.y) / (n * eccentricity)) * 180 / Math.PI;
  if (e_vec.z < 0) argumentOfPerigee = 360 - argumentOfPerigee;

  // True anomaly
  const dr = x * vx + y * vy + z * vz;
  let trueAnomaly = Math.acos((h * h / (MU * r) - 1) / eccentricity) * 180 / Math.PI;
  if (dr < 0) trueAnomaly = 360 - trueAnomaly;

  // Mean anomaly from eccentric anomaly
  const E = 2 * Math.atan2(
    Math.sqrt(1 - eccentricity) * Math.tan(trueAnomaly * Math.PI / 360),
    Math.sqrt(1 + eccentricity)
  );
  const meanAnomaly = (E - eccentricity * Math.sin(E)) * 180 / Math.PI;

  return {
    semiMajorAxis,
    eccentricity,
    inclination: inclination % 360,
    argumentOfPerigee: argumentOfPerigee % 360,
    rightAscension: rightAscension % 360,
    meanAnomaly: meanAnomaly % 360
  };
}

/**
 * Propagate orbit using SGP4 simplified model
 * (Note: This is simplified; full SGP4 is more complex)
 */
export function propagateOrbit(
  elements: OrbitalElements,
  deltaTime: number  // seconds
): OrbitalElements {
  const n = calculateMeanMotion(elements.semiMajorAxis);
  const newMeanAnomaly = (elements.meanAnomaly + n * deltaTime * 180 / Math.PI) % 360;

  return {
    ...elements,
    meanAnomaly: newMeanAnomaly < 0 ? newMeanAnomaly + 360 : newMeanAnomaly
  };
}

/**
 * Calculate satellite's latitude/longitude from state vector
 */
export function stateVectorToGeographic(state: StateVector): { latitude: number; longitude: number; altitude: number } {
  const { x, y, z } = state.position;

  // Distance from Earth's center
  const r = Math.sqrt(x * x + y * y + z * z);
  const altitude = r - EARTH_RADIUS;

  // Latitude and longitude
  const latitude = Math.asin(z / r) * 180 / Math.PI;
  const longitude = Math.atan2(y, x) * 180 / Math.PI;

  return {
    latitude,
    longitude: longitude < 0 ? longitude + 360 : longitude,
    altitude
  };
}

/**
 * Calculate time until next eclipse for a satellite
 */
export function calculateEclipseDuration(semiMajorAxis: number, inclination: number): { duration: number; frequency: number } {
  const orbitalPeriod = calculateOrbitalPeriod(semiMajorAxis);
  
  // Simplified: eclipse duration depends on altitude and inclination
  // At higher altitudes and higher inclinations, eclipses are shorter and less frequent
  const altitudeKm = semiMajorAxis - EARTH_RADIUS;
  
  // Earth's angular radius as seen from satellite
  const earthAngle = Math.asin(EARTH_RADIUS / semiMajorAxis) * 180 / Math.PI;
  
  // Shadow half-angle
  const shadowAngle = Math.asin(EARTH_RADIUS / semiMajorAxis) * 2 * 180 / Math.PI;
  
  // Time in eclipse per orbit (simplified)
  const eclipseFraction = shadowAngle / 180;
  const eclipseDuration = orbitalPeriod * eclipseFraction;
  
  // Frequency of eclipses depends on inclination
  // Equatorial orbits don't have sun-synchronous eclipses
  const sunSyncFactor = Math.cos(inclination * Math.PI / 180);
  const eclipseFrequency = orbitalPeriod / (1 + sunSyncFactor);
  
  return {
    duration: eclipseDuration,
    frequency: eclipseFrequency
  };
}
