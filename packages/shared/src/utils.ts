/**
 * OrbitalMind Shared Utilities and Mathematical Functions
 */

/**
 * Calculate distance between orbital positions (Haversine)
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * CRC-32 calculation for frame integrity
 */
export function calculateCRC32(data: Buffer): number {
  const polynomial = 0xedb88320;
  let crc = 0xffffffff;

  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ ((crc & 1) ? polynomial : 0);
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Exponential backoff with jitter
 */
export function exponentialBackoff(
  attempt: number,
  baseDelayMs: number = 50,
  maxDelayMs: number = 30000
): number {
  const exponential = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
  const jitter = exponential * 0.1 * Math.random();
  return exponential + jitter;
}

/**
 * Calculate orbital period using Kepler's third law
 */
export function calculateOrbitalPeriod(altitudeKm: number): number {
  const earthRadius = 6371;
  const a = (earthRadius + altitudeKm) * 1000;
  const mu = 3.986e14; // Standard gravitational parameter
  return 2 * Math.PI * Math.sqrt(Math.pow(a, 3) / mu);
}

/**
 * Estimate power consumption: P = C * V² * f
 */
export function estimatePower(
  frequencyMHz: number,
  voltageVolts: number,
  capacitanceFarads: number = 0.001
): number {
  return capacitanceFarads * voltageVolts * voltageVolts * (frequencyMHz / 1000);
}

/**
 * Estimate junction temperature: T_j = T_ambient + P * θ_ja
 */
export function estimateJunctionTemperature(
  ambientTemp: number,
  powerWatts: number,
  thermalResistance: number = 10
): number {
  return ambientTemp + powerWatts * thermalResistance;
}

/**
 * Hamming distance between two buffers
 */
export function hammingDistance(a: Buffer, b: Buffer): number {
  if (a.length !== b.length) {
    throw new Error('Buffers must be same length');
  }

  let distance = 0;
  for (let i = 0; i < a.length; i++) {
    let xor = a[i] ^ b[i];
    while (xor) {
      distance += xor & 1;
      xor >>= 1;
    }
  }

  return distance;
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Format duration to human-readable string
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/**
 * Generate random ID
 */
export function generateID(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  return prefix ? `${prefix}-${timestamp}-${randomPart}` : `${timestamp}-${randomPart}`;
}

/**
 * Retry function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelayMs: number = 100
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts - 1) {
        const delay = exponentialBackoff(attempt, baseDelayMs);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Create a timeout promise
 */
export function timeout<T>(
  promise: Promise<T>,
  ms: number
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), ms)
    )
  ]);
}

/**
 * Linear interpolation
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

/**
 * Clamp value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Sleep for specified milliseconds
 */
export async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create hash from string
 */
export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}
