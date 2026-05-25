/**
 * OrbitalMind Service Integration Examples
 *
 * Practical patterns for integrating monitoring into all 12 OrbitalMind services
 * Demonstrates how each service should record metrics, track health, and handle alerts
 */

import { createMonitoringClient } from './api-client';
import MetricsCollector from './metrics-collector';

/**
 * Space Traffic Management Service
 * Tracks satellite collision detection performance and traffic optimization
 */
export class SpaceTrafficServiceMonitor {
  private client = createMonitoringClient('http://localhost:3000');
  private collector = new MetricsCollector('space-traffic');
  private serviceName = 'space-traffic';

  async initialize(): Promise<void> {
    // Start periodic metric flushing every 5 seconds
    this.collector.startPeriodicFlush(5000);

    // Set up flush callback to send to API
    this.collector.setFlushCallback(async (batch) => {
      try {
        await this.client.recordMetrics(batch.serviceName,
          batch.metrics.map(m => ({
            name: m.name,
            value: m.value,
            unit: m.unit,
            threshold: m.threshold
          }))
        );
      } catch (error) {
        console.error('Failed to record metrics:', error);
      }
    });
  }

  /**
   * Record collision detection operation
   */
  recordCollisionDetection(satelliteCount: number, duration: number, detected: number): void {
    this.collector.recordLatency('collision_detection', duration);
    this.collector.recordMetric('satellites_tracked', satelliteCount);
    this.collector.recordMetric('collisions_detected', detected);

    if (detected > 0) {
      this.collector.recordMetric('detection_accuracy', 100);
    }
  }

  /**
   * Record traffic optimization metrics
   */
  recordTrafficOptimization(orbitalSlots: number, utilisationPercent: number): void {
    this.collector.recordMetric('orbital_slots_available', orbitalSlots);
    this.collector.recordMetric('utilisation_percent', utilisationPercent);
  }

  /**
   * Record communication events
   */
  recordCommunication(success: boolean, latency: number): void {
    if (success) {
      this.collector.recordLatency('inter_satellite_comm', latency);
    } else {
      this.collector.recordError('communication_failure');
    }
  }

  /**
   * Update service health status
   */
  async updateHealth(): Promise<void> {
    const stats = this.collector.getMetricStats('collision_detection');
    const errorStats = this.collector.getMetricStats('errors_communication_failure');

    const errorRate = (errorStats.count || 0) / (stats.count || 1);
    const status = errorRate > 0.05 ? 'degraded' : 'healthy';

    await this.client.updateHealth(this.serviceName, status, {
      uptime: 99.5,
      averageLatency: stats.avg || 0,
      errorRate: errorRate * 100
    });
  }
}

/**
 * Digital Twin Service
 * Tracks orbital propagation, state synchronization, and simulation accuracy
 */
export class DigitalTwinServiceMonitor {
  private client = createMonitoringClient('http://localhost:3000');
  private collector = new MetricsCollector('digital-twin');
  private serviceName = 'digital-twin';

  async initialize(): Promise<void> {
    this.collector.startPeriodicFlush(5000);

    this.collector.setFlushCallback(async (batch) => {
      try {
        await this.client.recordMetrics(batch.serviceName,
          batch.metrics.map(m => ({
            name: m.name,
            value: m.value,
            unit: m.unit,
            threshold: m.threshold
          }))
        );
      } catch (error) {
        console.error('Failed to record metrics:', error);
      }
    });
  }

  /**
   * Record orbital propagation simulation
   */
  recordPropagation(duration: number, accuracy: number, stateCount: number): void {
    this.collector.recordLatency('propagation', duration);
    this.collector.recordMetric('propagation_accuracy', accuracy);
    this.collector.recordMetric('synchronized_states', stateCount);
  }

  /**
   * Record cache performance
   */
  recordCacheOperation(hit: boolean, duration: number): void {
    if (hit) {
      this.collector.recordMetric('cache_hits', 1);
    } else {
      this.collector.recordMetric('cache_misses', 1);
    }
    this.collector.recordLatency('cache_access', duration);
  }

  /**
   * Record state synchronization
   */
  recordSync(objectCount: number, syncTime: number, conflicts: number): void {
    this.collector.recordMetric('synced_objects', objectCount);
    this.collector.recordLatency('sync_duration', syncTime);
    this.collector.recordMetric('sync_conflicts', conflicts);
  }

  async updateHealth(): Promise<void> {
    const propStats = this.collector.getMetricStats('latency_propagation');
    const hitMetric = this.collector.getMetricValue('cache_hits') || 0;
    const missMetric = this.collector.getMetricValue('cache_misses') || 0;
    const hitRate = hitMetric / (hitMetric + missMetric) * 100;

    await this.client.updateHealth(this.serviceName, 'healthy', {
      uptime: 99.8,
      averageLatency: propStats.avg || 0,
      errorRate: 0.1
    });
  }
}

/**
 * Orbital Networking Service
 * Tracks routing performance, link utilization, and network optimization
 */
export class OrbitalNetworkingServiceMonitor {
  private client = createMonitoringClient('http://localhost:3000');
  private collector = new MetricsCollector('orbital-networking');
  private serviceName = 'orbital-networking';

  async initialize(): Promise<void> {
    this.collector.startPeriodicFlush(5000);

    this.collector.setFlushCallback(async (batch) => {
      try {
        await this.client.recordMetrics(batch.serviceName,
          batch.metrics.map(m => ({
            name: m.name,
            value: m.value,
            unit: m.unit,
            threshold: m.threshold
          }))
        );
      } catch (error) {
        console.error('Failed to record metrics:', error);
      }
    });
  }

  /**
   * Record route computation
   */
  recordRouting(sourceId: string, destId: string, hopCount: number, duration: number): void {
    this.collector.recordLatency('route_computation', duration);
    this.collector.recordMetric('hops_calculated', hopCount);
    this.collector.recordMetric('routes_computed', 1);
  }

  /**
   * Record link utilization
   */
  recordLinkUtilization(linkId: string, utilization: number, bandwidth: number): void {
    this.collector.recordMetric(`link_util_${linkId}`, utilization);
    this.collector.recordMetric(`link_bandwidth_${linkId}`, bandwidth);
  }

  /**
   * Record packet forwarding
   */
  recordPacketForwarding(success: boolean, latency: number): void {
    if (success) {
      this.collector.recordLatency('packet_forwarding', latency);
      this.collector.recordMetric('packets_forwarded', 1);
    } else {
      this.collector.recordError('packet_drop');
    }
  }

  async updateHealth(): Promise<void> {
    const routeStats = this.collector.getMetricStats('latency_route_computation');
    const dropStats = this.collector.getMetricStats('errors_packet_drop');
    const dropRate = (dropStats.count || 0) / 10000; // Estimate based on sample

    await this.client.updateHealth(this.serviceName, 'healthy', {
      uptime: 99.9,
      averageLatency: routeStats.avg || 0,
      errorRate: dropRate
    });
  }
}

/**
 * Thermal Engine Service
 * Tracks temperature monitoring, thermal modeling, and heat dissipation
 */
export class ThermalEngineServiceMonitor {
  private client = createMonitoringClient('http://localhost:3000');
  private collector = new MetricsCollector('thermal-engine');
  private serviceName = 'thermal-engine';

  async initialize(): Promise<void> {
    this.collector.startPeriodicFlush(5000);

    this.collector.setFlushCallback(async (batch) => {
      try {
        await this.client.recordMetrics(batch.serviceName,
          batch.metrics.map(m => ({
            name: m.name,
            value: m.value,
            unit: m.unit,
            threshold: m.threshold
          }))
        );
      } catch (error) {
        console.error('Failed to record metrics:', error);
      }
    });
  }

  /**
   * Record temperature reading
   */
  recordTemperature(component: string, temp: number, limit: number): void {
    this.collector.recordMetric(`temp_${component}`, temp);

    if (temp > limit * 0.9) {
      this.collector.recordMetric(`thermal_warning_${component}`, 1);
    }
  }

  /**
   * Record thermal calculation
   */
  recordThermalCalculation(duration: number, accuracy: number): void {
    this.collector.recordLatency('thermal_calculation', duration);
    this.collector.recordMetric('thermal_accuracy', accuracy);
  }

  /**
   * Record heat dissipation
   */
  recordHeatDissipation(watts: number): void {
    this.collector.recordMetric('heat_dissipation_watts', watts);
  }

  async updateHealth(): Promise<void> {
    const calcStats = this.collector.getMetricStats('latency_thermal_calculation');
    const warnings = this.collector.getAllMetrics();
    const warningCount = Object.values(warnings).filter(
      v => typeof v === 'number' && v > 0 &&
      Object.keys(warnings).find(k => k.includes('thermal_warning'))
    ).length;

    const status = warningCount > 5 ? 'degraded' : 'healthy';

    await this.client.updateHealth(this.serviceName, status, {
      uptime: 99.7,
      averageLatency: calcStats.avg || 0,
      errorRate: warningCount / 100
    });
  }
}

/**
 * Science Ops Service
 * Tracks spectral analysis, data processing, and scientific data handling
 */
export class ScienceOpsServiceMonitor {
  private client = createMonitoringClient('http://localhost:3000');
  private collector = new MetricsCollector('science-ops');
  private serviceName = 'science-ops';

  async initialize(): Promise<void> {
    this.collector.startPeriodicFlush(5000);

    this.collector.setFlushCallback(async (batch) => {
      try {
        await this.client.recordMetrics(batch.serviceName,
          batch.metrics.map(m => ({
            name: m.name,
            value: m.value,
            unit: m.unit,
            threshold: m.threshold
          }))
        );
      } catch (error) {
        console.error('Failed to record metrics:', error);
      }
    });
  }

  /**
   * Record spectral analysis
   */
  recordSpectralAnalysis(duration: number, pixelCount: number, quality: number): void {
    this.collector.recordLatency('spectral_analysis', duration);
    this.collector.recordMetric('pixels_processed', pixelCount);
    this.collector.recordMetric('spectral_quality', quality);
  }

  /**
   * Record NDVI calculation
   */
  recordNDVICalculation(duration: number, accuracy: number): void {
    this.collector.recordLatency('ndvi_calculation', duration);
    this.collector.recordMetric('ndvi_accuracy', accuracy);
  }

  /**
   * Record data processing
   */
  recordDataProcessing(dataPoints: number, duration: number): void {
    this.collector.recordMetric('data_points_processed', dataPoints);
    this.collector.recordLatency('data_processing', duration);
  }

  async updateHealth(): Promise<void> {
    const spectralStats = this.collector.getMetricStats('latency_spectral_analysis');

    await this.client.updateHealth(this.serviceName, 'healthy', {
      uptime: 99.6,
      averageLatency: spectralStats.avg || 0,
      errorRate: 0.2
    });
  }
}

/**
 * Blockchain Service
 * Tracks ledger operations, query performance, and data consistency
 */
export class BlockchainServiceMonitor {
  private client = createMonitoringClient('http://localhost:3000');
  private collector = new MetricsCollector('blockchain');
  private serviceName = 'blockchain';

  async initialize(): Promise<void> {
    this.collector.startPeriodicFlush(5000);

    this.collector.setFlushCallback(async (batch) => {
      try {
        await this.client.recordMetrics(batch.serviceName,
          batch.metrics.map(m => ({
            name: m.name,
            value: m.value,
            unit: m.unit,
            threshold: m.threshold
          }))
        );
      } catch (error) {
        console.error('Failed to record metrics:', error);
      }
    });
  }

  /**
   * Record ledger query
   */
  recordQuery(duration: number, cacheHit: boolean, resultSize: number): void {
    this.collector.recordLatency('ledger_query', duration);

    if (cacheHit) {
      this.collector.recordMetric('cache_hits', 1);
    } else {
      this.collector.recordMetric('cache_misses', 1);
    }

    this.collector.recordMetric('query_result_size', resultSize);
  }

  /**
   * Record transaction
   */
  recordTransaction(duration: number, success: boolean): void {
    if (success) {
      this.collector.recordLatency('transaction_time', duration);
      this.collector.recordMetric('transactions_committed', 1);
    } else {
      this.collector.recordError('transaction_failure');
    }
  }

  /**
   * Record block validation
   */
  recordBlockValidation(blockSize: number, duration: number): void {
    this.collector.recordMetric('block_size', blockSize);
    this.collector.recordLatency('block_validation', duration);
  }

  async updateHealth(): Promise<void> {
    const queryStats = this.collector.getMetricStats('latency_ledger_query');
    const hitMetric = this.collector.getMetricValue('cache_hits') || 0;
    const missMetric = this.collector.getMetricValue('cache_misses') || 0;
    const hitRate = (hitMetric / (hitMetric + missMetric)) * 100;

    await this.client.updateHealth(this.serviceName, 'healthy', {
      uptime: 99.9,
      averageLatency: queryStats.avg || 0,
      errorRate: 0.05
    });
  }
}

/**
 * Attitude Determination Service
 * Tracks orientation calculations and sensor fusion
 */
export class AttitudeDeterminationServiceMonitor {
  private client = createMonitoringClient('http://localhost:3000');
  private collector = new MetricsCollector('attitude-determination');
  private serviceName = 'attitude-determination';

  async initialize(): Promise<void> {
    this.collector.startPeriodicFlush(5000);
    this.collector.setFlushCallback(async (batch) => {
      try {
        await this.client.recordMetrics(batch.serviceName,
          batch.metrics.map(m => ({
            name: m.name,
            value: m.value,
            unit: m.unit,
            threshold: m.threshold
          }))
        );
      } catch (error) {
        console.error('Failed to record metrics:', error);
      }
    });
  }

  recordOrientationCalculation(duration: number, accuracy: number): void {
    this.collector.recordLatency('orientation_calc', duration);
    this.collector.recordMetric('orientation_accuracy_deg', accuracy);
  }

  recordSensorFusion(sensorCount: number, duration: number): void {
    this.collector.recordMetric('sensors_fused', sensorCount);
    this.collector.recordLatency('sensor_fusion', duration);
  }

  async updateHealth(): Promise<void> {
    const calcStats = this.collector.getMetricStats('latency_orientation_calc');
    await this.client.updateHealth(this.serviceName, 'healthy', {
      uptime: 99.8,
      averageLatency: calcStats.avg || 0,
      errorRate: 0.1
    });
  }
}

/**
 * Propulsion System Service
 * Tracks thruster performance and fuel consumption
 */
export class PropulsionSystemServiceMonitor {
  private client = createMonitoringClient('http://localhost:3000');
  private collector = new MetricsCollector('propulsion-system');
  private serviceName = 'propulsion-system';

  async initialize(): Promise<void> {
    this.collector.startPeriodicFlush(5000);
    this.collector.setFlushCallback(async (batch) => {
      try {
        await this.client.recordMetrics(batch.serviceName,
          batch.metrics.map(m => ({
            name: m.name,
            value: m.value,
            unit: m.unit,
            threshold: m.threshold
          }))
        );
      } catch (error) {
        console.error('Failed to record metrics:', error);
      }
    });
  }

  recordThrustCommand(thruster: string, duration: number, fuel: number): void {
    this.collector.recordLatency(`thrust_${thruster}`, duration);
    this.collector.recordMetric(`fuel_consumed_${thruster}`, fuel);
  }

  recordBurnCalculation(duration: number, accuracy: number): void {
    this.collector.recordLatency('burn_calculation', duration);
    this.collector.recordMetric('burn_accuracy', accuracy);
  }

  async updateHealth(): Promise<void> {
    const burnStats = this.collector.getMetricStats('latency_burn_calculation');
    await this.client.updateHealth(this.serviceName, 'healthy', {
      uptime: 99.7,
      averageLatency: burnStats.avg || 0,
      errorRate: 0.15
    });
  }
}

/**
 * Communication System Service
 * Tracks signal strength and data transmission
 */
export class CommunicationSystemServiceMonitor {
  private client = createMonitoringClient('http://localhost:3000');
  private collector = new MetricsCollector('communication-system');
  private serviceName = 'communication-system';

  async initialize(): Promise<void> {
    this.collector.startPeriodicFlush(5000);
    this.collector.setFlushCallback(async (batch) => {
      try {
        await this.client.recordMetrics(batch.serviceName,
          batch.metrics.map(m => ({
            name: m.name,
            value: m.value,
            unit: m.unit,
            threshold: m.threshold
          }))
        );
      } catch (error) {
        console.error('Failed to record metrics:', error);
      }
    });
  }

  recordSignalStrength(frequency: string, dbm: number): void {
    this.collector.recordMetric(`signal_${frequency}_dbm`, dbm);
  }

  recordDataTransmission(bytes: number, duration: number, success: boolean): void {
    if (success) {
      this.collector.recordMetric('bytes_transmitted', bytes);
      this.collector.recordLatency('transmission_time', duration);
    } else {
      this.collector.recordError('transmission_failure');
    }
  }

  async updateHealth(): Promise<void> {
    const txStats = this.collector.getMetricStats('latency_transmission_time');
    await this.client.updateHealth(this.serviceName, 'healthy', {
      uptime: 99.5,
      averageLatency: txStats.avg || 0,
      errorRate: 0.2
    });
  }
}

/**
 * Power Management Service
 * Tracks battery status and power allocation
 */
export class PowerManagementServiceMonitor {
  private client = createMonitoringClient('http://localhost:3000');
  private collector = new MetricsCollector('power-management');
  private serviceName = 'power-management';

  async initialize(): Promise<void> {
    this.collector.startPeriodicFlush(5000);
    this.collector.setFlushCallback(async (batch) => {
      try {
        await this.client.recordMetrics(batch.serviceName,
          batch.metrics.map(m => ({
            name: m.name,
            value: m.value,
            unit: m.unit,
            threshold: m.threshold
          }))
        );
      } catch (error) {
        console.error('Failed to record metrics:', error);
      }
    });
  }

  recordBatteryStatus(percentage: number, voltage: number): void {
    this.collector.recordMetric('battery_percent', percentage);
    this.collector.recordMetric('battery_voltage', voltage);
  }

  recordPowerAllocation(component: string, watts: number): void {
    this.collector.recordMetric(`power_${component}_watts`, watts);
  }

  async updateHealth(): Promise<void> {
    const batPercent = this.collector.getMetricValue('battery_percent') || 50;
    const status = batPercent < 20 ? 'degraded' : 'healthy';

    await this.client.updateHealth(this.serviceName, status, {
      uptime: 99.9,
      averageLatency: 5,
      errorRate: 0.05
    });
  }
}

/**
 * Sensor Integration Service
 * Tracks multi-sensor data fusion and calibration
 */
export class SensorIntegrationServiceMonitor {
  private client = createMonitoringClient('http://localhost:3000');
  private collector = new MetricsCollector('sensor-integration');
  private serviceName = 'sensor-integration';

  async initialize(): Promise<void> {
    this.collector.startPeriodicFlush(5000);
    this.collector.setFlushCallback(async (batch) => {
      try {
        await this.client.recordMetrics(batch.serviceName,
          batch.metrics.map(m => ({
            name: m.name,
            value: m.value,
            unit: m.unit,
            threshold: m.threshold
          }))
        );
      } catch (error) {
        console.error('Failed to record metrics:', error);
      }
    });
  }

  recordSensorReading(sensorType: string, duration: number, value: number): void {
    this.collector.recordLatency(`sensor_${sensorType}`, duration);
    this.collector.recordMetric(`${sensorType}_value`, value);
  }

  recordCalibration(sensorType: string, duration: number, error: number): void {
    this.collector.recordLatency(`calib_${sensorType}`, duration);
    this.collector.recordMetric(`calib_error_${sensorType}`, error);
  }

  async updateHealth(): Promise<void> {
    const readStats = this.collector.getMetricStats('latency_sensor_');
    await this.client.updateHealth(this.serviceName, 'healthy', {
      uptime: 99.6,
      averageLatency: readStats.avg || 0,
      errorRate: 0.1
    });
  }
}

/**
 * Autonomous Navigation Service
 * Tracks autonomous decision making and path planning
 */
export class AutonomousNavigationServiceMonitor {
  private client = createMonitoringClient('http://localhost:3000');
  private collector = new MetricsCollector('autonomous-navigation');
  private serviceName = 'autonomous-navigation';

  async initialize(): Promise<void> {
    this.collector.startPeriodicFlush(5000);
    this.collector.setFlushCallback(async (batch) => {
      try {
        await this.client.recordMetrics(batch.serviceName,
          batch.metrics.map(m => ({
            name: m.name,
            value: m.value,
            unit: m.unit,
            threshold: m.threshold
          }))
        );
      } catch (error) {
        console.error('Failed to record metrics:', error);
      }
    });
  }

  recordPathPlanning(duration: number, pathLength: number): void {
    this.collector.recordLatency('path_planning', duration);
    this.collector.recordMetric('path_length_units', pathLength);
  }

  recordObstacleDetection(obstacles: number, duration: number): void {
    this.collector.recordMetric('obstacles_detected', obstacles);
    this.collector.recordLatency('obstacle_detection', duration);
  }

  async updateHealth(): Promise<void> {
    const planStats = this.collector.getMetricStats('latency_path_planning');
    await this.client.updateHealth(this.serviceName, 'healthy', {
      uptime: 99.7,
      averageLatency: planStats.avg || 0,
      errorRate: 0.1
    });
  }
}

export default {
  SpaceTrafficServiceMonitor,
  DigitalTwinServiceMonitor,
  OrbitalNetworkingServiceMonitor,
  ThermalEngineServiceMonitor,
  ScienceOpsServiceMonitor,
  BlockchainServiceMonitor,
  AttitudeDeterminationServiceMonitor,
  PropulsionSystemServiceMonitor,
  CommunicationSystemServiceMonitor,
  PowerManagementServiceMonitor,
  SensorIntegrationServiceMonitor,
  AutonomousNavigationServiceMonitor,
};
