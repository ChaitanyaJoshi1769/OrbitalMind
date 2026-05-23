/**
 * OrbitalMind Thermal Management System
 * Manages temperature, DVFS, and thermal-aware workload scheduling
 */

import { ThermalState, ThermalStatus, SystemConfig, clamp } from '@orbitalmind/shared';

export interface ThermalSensorReadings {
  junctionTemp: number;
  caseTemp: number;
  radiatorTemp: number;
  heatsinkTemp: number;
  powerDraw: number;
  timestamp: Date;
}

export interface DVFSState {
  frequency: number;
  voltage: number;
  power: number;
}

export interface ThermalModel {
  timeConstant: number;
  steadyStateTempDelta: number;
  ambientTemp: number;
}

/**
 * Main thermal management controller
 */
export class ThermalManager {
  private currentState: ThermalState;
  private thermalModel: ThermalModel;
  private config: SystemConfig;
  private sensorHistory: ThermalSensorReadings[] = [];
  private dvfsController: DVFSController;

  constructor(config: SystemConfig) {
    this.config = config;
    this.dvfsController = new DVFSController();

    this.currentState = {
      junctionTemperature: 25,
      caseTemperature: 25,
      radiatorTemperature: 20,
      heatsinkTemperature: 25,
      currentPower: 0,
      thermalCapacity: 50,
      timeConstant: 45,
      predictedTemperature30min: 25,
      thermalMargin: 60,
      status: ThermalStatus.Normal
    };

    this.thermalModel = {
      timeConstant: 45,
      steadyStateTempDelta: 10,
      ambientTemp: 20
    };
  }

  /**
   * Update thermal state with sensor readings
   */
  public updateSensorReadings(readings: ThermalSensorReadings): void {
    this.sensorHistory.push(readings);

    if (this.sensorHistory.length > 3600) {
      this.sensorHistory.shift();
    }

    this.currentState.junctionTemperature = readings.junctionTemp;
    this.currentState.caseTemperature = readings.caseTemp;
    this.currentState.radiatorTemperature = readings.radiatorTemp;
    this.currentState.heatsinkTemperature = readings.heatsinkTemp;
    this.currentState.currentPower = readings.powerDraw;

    const maxTemp = this.config.thermalCriticalThreshold;
    this.currentState.thermalMargin = maxTemp - readings.junctionTemp;

    this.predictTemperature30min();
    this.updateThermalStatus();
  }

  /**
   * Predict 30-minute temperature
   */
  private predictTemperature30min(): void {
    if (this.sensorHistory.length < 10) {
      const current = this.currentState.junctionTemperature;
      const trend = this.calculateTemperatureTrend();
      this.currentState.predictedTemperature30min = current + (trend * 30 * 60);
      return;
    }

    const timeSeconds = 30 * 60;
    const tau = this.thermalModel.timeConstant;
    const steadyState = this.thermalModel.ambientTemp +
      (this.currentState.currentPower * this.thermalModel.steadyStateTempDelta);

    const predicted = this.thermalModel.ambientTemp +
      (steadyState - this.thermalModel.ambientTemp) *
      (1 - Math.exp(-timeSeconds / tau));

    this.currentState.predictedTemperature30min = predicted;
  }

  /**
   * Calculate temperature trend (dT/dt)
   */
  private calculateTemperatureTrend(): number {
    if (this.sensorHistory.length < 2) return 0;

    const recent = this.sensorHistory.slice(-10);
    let sumTrend = 0;

    for (let i = 1; i < recent.length; i++) {
      const dt = (recent[i].timestamp.getTime() - recent[i - 1].timestamp.getTime()) / 1000;
      const dT = recent[i].junctionTemp - recent[i - 1].junctionTemp;
      sumTrend += dT / dt;
    }

    return sumTrend / (recent.length - 1);
  }

  /**
   * Update thermal status
   */
  private updateThermalStatus(): void {
    const temp = this.currentState.junctionTemperature;

    if (temp >= this.config.thermalCriticalThreshold) {
      this.currentState.status = ThermalStatus.Critical;
    } else if (temp >= this.config.thermalWarningThreshold) {
      this.currentState.status = ThermalStatus.Warning;
    } else if (temp >= this.config.thermalLowPowerThreshold) {
      this.currentState.status = ThermalStatus.Elevated;
    } else {
      this.currentState.status = ThermalStatus.Normal;
    }
  }

  /**
   * Get current thermal state
   */
  public getState(): ThermalState {
    return { ...this.currentState };
  }

  /**
   * Request DVFS adjustment
   */
  public requestDVFSAdjustment(): DVFSState {
    const temp = this.currentState.junctionTemperature;
    const predicted = this.currentState.predictedTemperature30min;

    if (predicted > this.config.thermalWarningThreshold) {
      return this.dvfsController.reduceFrequency(0.9);
    }

    if (temp > this.config.thermalWarningThreshold) {
      return this.dvfsController.reduceFrequency(0.75);
    }

    if (temp > this.config.thermalCriticalThreshold) {
      return this.dvfsController.reduceFrequency(0.5);
    }

    if (temp < 40) {
      return this.dvfsController.increaseFrequency(1.1);
    }

    return this.dvfsController.getNominalFrequency();
  }

  /**
   * Get available power budget
   */
  public getAvailablePowerBudget(): number {
    const remainingMargin = this.currentState.thermalMargin;
    const maxTempRise = Math.max(0, remainingMargin - 5);

    const availablePower = maxTempRise / this.thermalModel.steadyStateTempDelta;
    return Math.max(0, availablePower);
  }

  /**
   * Estimate cooling time to target temperature
   */
  public estimateCoolingTime(targetTemp: number): number {
    const current = this.currentState.junctionTemperature;
    const tau = this.thermalModel.timeConstant;
    const ambient = this.thermalModel.ambientTemp;

    if (current <= targetTemp) return 0;

    const ratio = (targetTemp - ambient) / (current - ambient);
    if (ratio <= 0) return Infinity;

    return -tau * Math.log(ratio);
  }
}

/**
 * DVFS Controller
 */
export class DVFSController {
  private currentFrequency: number = 1500;
  private currentVoltage: number = 1.0;
  private nominalFrequency: number = 1500;
  private minFrequency: number = 500;
  private maxFrequency: number = 2500;
  private minVoltage: number = 0.7;
  private maxVoltage: number = 1.2;

  /**
   * Get current DVFS state
   */
  public getCurrentState(): DVFSState {
    const power = this.estimatePower();
    return {
      frequency: this.currentFrequency,
      voltage: this.currentVoltage,
      power: power
    };
  }

  /**
   * Get nominal frequency state
   */
  public getNominalFrequency(): DVFSState {
    this.currentFrequency = this.nominalFrequency;
    this.currentVoltage = 1.0;
    return this.getCurrentState();
  }

  /**
   * Reduce frequency by factor
   */
  public reduceFrequency(factor: number): DVFSState {
    const newFreq = Math.max(
      this.minFrequency,
      this.currentFrequency * factor
    );
    this.setFrequency(newFreq);
    return this.getCurrentState();
  }

  /**
   * Increase frequency by factor
   */
  public increaseFrequency(factor: number): DVFSState {
    const newFreq = Math.min(
      this.maxFrequency,
      this.currentFrequency * factor
    );
    this.setFrequency(newFreq);
    return this.getCurrentState();
  }

  /**
   * Set frequency and compute required voltage
   */
  public setFrequency(freqMHz: number): void {
    this.currentFrequency = clamp(freqMHz, this.minFrequency, this.maxFrequency);

    const freqRatio = this.currentFrequency / this.nominalFrequency;
    const voltageRatio = Math.sqrt(freqRatio);
    this.currentVoltage = 1.0 * voltageRatio;
    this.currentVoltage = clamp(this.currentVoltage, this.minVoltage, this.maxVoltage);
  }

  /**
   * Set target power
   */
  public setPowerTarget(powerWatts: number): void {
    const capacitance = 0.001;

    for (let freq = this.maxFrequency; freq >= this.minFrequency; freq -= 100) {
      this.setFrequency(freq);
      const power = this.estimatePower();
      if (power <= powerWatts) {
        break;
      }
    }
  }

  /**
   * Estimate power consumption: P = C * V² * f
   */
  private estimatePower(): number {
    const capacitance = 0.001;
    return capacitance * this.currentVoltage * this.currentVoltage *
           (this.currentFrequency / 1000);
  }
}
