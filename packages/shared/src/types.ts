/**
 * OrbitalMind Shared Type Definitions
 * Core types used across all system components
 */

export type SatelliteID = string & { readonly __brand: 'SatelliteID' };
export type InferenceTaskID = string & { readonly __brand: 'InferenceTaskID' };
export type ModelID = string & { readonly __brand: 'ModelID' };
export type NetworkNodeID = string & { readonly __brand: 'NetworkNodeID' };

/**
 * Orbital Position and Ephemeris
 */
export interface OrbitalPosition {
  latitude: number;      // degrees, -90 to 90
  longitude: number;     // degrees, -180 to 180
  altitude: number;      // km above sea level
  timestamp: Date;
  velocity?: { x: number; y: number; z: number };  // m/s in ECI frame
}

/**
 * Spacecraft Health Metrics
 */
export interface HealthMetrics {
  satelliteID: SatelliteID;
  timestamp: Date;

  // Thermal
  cpuTemperature: number;
  caseTemperature: number;
  radiatorTemperature: number;

  // Power
  inputVoltage: number;
  currentDraw: number;
  batterySOC: number;           // 0-100%
  powerBudgetRemaining: number; // Watts

  // Radiation
  seuCount24h: number;
  criticalMemoryErrors: number;

  // Network
  availableInterSatelliteLinks: number;
  availableGroundLinks: number;

  // Compute
  utilizationCPU: number;       // 0-100%
  utilizationMemory: number;    // 0-100%
  availableInferenceCapacity: number; // TFLOPS

  // Status
  status: HealthStatus;
  lastCommandTime: Date;
}

export enum HealthStatus {
  Healthy = 'healthy',
  Degraded = 'degraded',
  Critical = 'critical',
  Offline = 'offline'
}

/**
 * Thermal State
 */
export interface ThermalState {
  junctionTemperature: number;
  caseTemperature: number;
  radiatorTemperature: number;
  heatsinkTemperature: number;

  currentPower: number;
  thermalCapacity: number;
  timeConstant: number;

  predictedTemperature30min: number;
  thermalMargin: number;
  status: ThermalStatus;
}

export enum ThermalStatus {
  Normal = 'normal',
  Elevated = 'elevated',
  Warning = 'warning',
  Critical = 'critical',
  Throttled = 'throttled'
}

/**
 * Radiation Environment
 */
export interface RadiationEnvironment {
  timestamp: Date;
  latitude: number;
  longitude: number;
  altitude: number;

  protonFlux: number;
  electronFlux: number;
  neutronFlux: number;

  doseRate: number;  // rad(Si)/day
  letEnvironment: string;
  inSouthAtlanticAnomaly: boolean;
}

/**
 * Radiation Event
 */
export interface RadiationEvent {
  timestamp: Date;
  satelliteID: SatelliteID;
  eventType: 'SEU' | 'SET' | 'SEL' | 'SEFI' | 'TID';
  location?: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  corrected: boolean;
  recoveryStatus: 'recovered' | 'pending' | 'failed';
  details?: Record<string, unknown>;
}

/**
 * Inference Task
 */
export interface InferenceTask {
  id: InferenceTaskID;
  modelID: ModelID;
  input: Float32Array | Buffer;
  priority: TaskPriority;
  deadline?: Date;

  createdAt: Date;
  assignedSatellite?: SatelliteID;
  startedAt?: Date;
  completedAt?: Date;

  output?: Float32Array | Buffer;
  error?: string;
  latency?: number;
}

export enum TaskPriority {
  Critical = 4,
  High = 3,
  Normal = 2,
  Low = 1
}

/**
 * AI Model Metadata
 */
export interface ModelMetadata {
  id: ModelID;
  name: string;
  version: string;

  // Architecture
  framework: 'pytorch' | 'onnx' | 'tensorrt';
  inputShape: number[];
  outputShape: number[];

  // Performance
  inferenceLatency: number;
  memoryfootprint: number;
  peakPower: number;
  averagePower: number;

  // Radiation resilience
  requiresRedundancy: boolean;
  supportsCheckpointing: boolean;
  maxSEUTolerance: number;

  // Distribution
  replicationFactor: number;
  requiredUpdateFrequency: number;
}

/**
 * Network Frame
 */
export interface NetworkFrame {
  sourceID: SatelliteID;
  destinationID: SatelliteID;
  sequenceNumber: number;
  frameType: 'data' | 'ack' | 'nack' | 'routing' | 'heartbeat';
  payload: Buffer;
  timestamp: Date;
  crc32?: number;
}

/**
 * Routing Table Entry
 */
export interface RoutingEntry {
  destination: SatelliteID;
  nextHop: SatelliteID;
  hopCount: number;
  linkStability: number;
  predictedDuration: number;
  estimatedLatency: number;
  cost: number;
  lastUpdated: Date;
}

/**
 * Constellation State
 */
export interface ConstellationState {
  satellites: Map<SatelliteID, HealthMetrics>;
  topology: NetworkTopology;
  globalWorkloadAllocation: Map<SatelliteID, InferenceTaskID[]>;
  globalThermalState: Map<SatelliteID, ThermalState>;
  timestamp: Date;
  version: number;
}

/**
 * Network Topology
 */
export interface NetworkTopology {
  edges: NetworkEdge[];
  nodes: Map<SatelliteID, OrbitalPosition>;
  timestamp: Date;
}

export interface NetworkEdge {
  from: SatelliteID;
  to: SatelliteID;
  type: 'oisl' | 'rf' | 'ground';
  quality: number;
  bandwidth: number;
  latency: number;
  active: boolean;
}

/**
 * Checkpoint for Fault Recovery
 */
export interface Checkpoint {
  taskID: InferenceTaskID;
  iteration: number;
  timestamp: Date;

  modelState: Buffer;
  inputBuffer: Buffer;
  computeState: Buffer;

  hash: string;
}

/**
 * System Configuration
 */
export interface SystemConfig {
  // Thermal
  thermalLowPowerThreshold: number;
  thermalWarningThreshold: number;
  thermalCriticalThreshold: number;

  // Power
  powerBudgetWatts: number;
  batteryMinimumSOC: number;

  // Radiation
  enableMemoryScrubbing: boolean;
  scrubInterval: number;
  enableRedundantExecution: boolean;

  // Network
  routingUpdateInterval: number;
  linkStateAge: number;
  maxRetries: number;

  // Inference
  maxModelSize: number;
  maxInferenceLatency: number;
  checkpointInterval: number;
}

/**
 * Utility functions to create branded types
 */
export function createSatelliteID(id: string): SatelliteID {
  return id as SatelliteID;
}

export function createInferenceTaskID(id: string): InferenceTaskID {
  return id as InferenceTaskID;
}

export function createModelID(id: string): ModelID {
  return id as ModelID;
}

export function createNetworkNodeID(id: string): NetworkNodeID {
  return id as NetworkNodeID;
}
