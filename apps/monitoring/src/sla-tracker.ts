/**
 * OrbitalMind SLA Compliance Tracker
 *
 * Tracks Service Level Agreement compliance for all services
 * Monitors uptime, latency, error rates, and generates compliance reports
 */

import pino from 'pino';

/**
 * SLA Target definition
 */
export interface SLATarget {
  serviceName: string;
  uptimePercent: number; // e.g., 99.5 for 99.5%
  p95LatencyMs: number; // e.g., 500 for 500ms
  p99LatencyMs: number; // e.g., 1000 for 1000ms
  errorRatePercent: number; // e.g., 0.1 for 0.1%
  availabilityWindowDays: number; // Measurement window in days
}

/**
 * SLA measurement period
 */
export interface SLAMeasurement {
  serviceName: string;
  timestamp: number;
  uptime: number;
  p95Latency: number;
  p99Latency: number;
  errorRate: number;
  incidentCount: number;
  downtimeMinutes: number;
}

/**
 * SLA compliance status
 */
export interface SLACompliance {
  serviceName: string;
  target: SLATarget;
  measurement: SLAMeasurement;
  uptime: {
    value: number;
    target: number;
    compliant: boolean;
    remainingBudgetMinutes: number;
  };
  latency: {
    p95: {
      value: number;
      target: number;
      compliant: boolean;
    };
    p99: {
      value: number;
      target: number;
      compliant: boolean;
    };
  };
  errorRate: {
    value: number;
    target: number;
    compliant: boolean;
  };
  overall: {
    compliant: boolean;
    compliancePercent: number;
    violationCount: number;
  };
  timestamp: number;
}

/**
 * SLA violation event
 */
export interface SLAViolation {
  serviceName: string;
  violationType: 'uptime' | 'latency_p95' | 'latency_p99' | 'errorRate';
  targetValue: number;
  actualValue: number;
  severity: 'critical' | 'warning' | 'info';
  timestamp: number;
  duration?: number;
}

/**
 * SLA Tracker
 */
export class SLATracker {
  private logger = pino();
  private targets: Map<string, SLATarget> = new Map();
  private measurements: Map<string, SLAMeasurement[]> = new Map();
  private violations: SLAViolation[] = [];
  private windowSize = 7; // Days to track

  /**
   * Set SLA targets for a service
   */
  setSLATarget(target: SLATarget): void {
    this.targets.set(target.serviceName, target);

    this.logger.info(
      {
        serviceName: target.serviceName,
        uptime: target.uptimePercent,
        p95Latency: target.p95LatencyMs,
        errorRate: target.errorRatePercent,
      },
      'SLA target configured'
    );
  }

  /**
   * Record a measurement for a service
   */
  recordMeasurement(measurement: SLAMeasurement): void {
    if (!this.measurements.has(measurement.serviceName)) {
      this.measurements.set(measurement.serviceName, []);
    }

    const measurements = this.measurements.get(measurement.serviceName)!;
    measurements.push(measurement);

    // Keep window size limited
    if (measurements.length > this.windowSize * 24) {
      measurements.shift();
    }
  }

  /**
   * Get SLA compliance for a service
   */
  getCompliance(serviceName: string): SLACompliance | null {
    const target = this.targets.get(serviceName);
    if (!target) {
      this.logger.warn({ serviceName }, 'No SLA target defined');
      return null;
    }

    const measurements = this.measurements.get(serviceName) || [];
    if (measurements.length === 0) {
      this.logger.warn({ serviceName }, 'No measurements recorded');
      return null;
    }

    // Use latest measurement
    const measurement = measurements[measurements.length - 1];

    // Calculate compliance status
    const uptimeCompliant = measurement.uptime >= target.uptimePercent;
    const p95Compliant = measurement.p95Latency <= target.p95LatencyMs;
    const p99Compliant = measurement.p99Latency <= target.p99LatencyMs;
    const errorCompliant = measurement.errorRate <= target.errorRatePercent;

    // Calculate remaining uptime budget
    const targetMinutesInWindow = (target.availabilityWindowDays * 24 * 60 * (target.uptimePercent / 100));
    const usedMinutes = target.availabilityWindowDays * 24 * 60 - (measurement.uptime / 100) * (target.availabilityWindowDays * 24 * 60);
    const remainingBudgetMinutes = targetMinutesInWindow - usedMinutes;

    // Overall compliance
    const violationCount = [!uptimeCompliant, !p95Compliant, !p99Compliant, !errorCompliant].filter(v => v).length;
    const compliancePercent = Math.max(0, (4 - violationCount) / 4 * 100);

    // Record violations
    if (!uptimeCompliant) {
      this.recordViolation({
        serviceName,
        violationType: 'uptime',
        targetValue: target.uptimePercent,
        actualValue: measurement.uptime,
        severity: measurement.uptime < 95 ? 'critical' : 'warning',
        timestamp: measurement.timestamp,
      });
    }

    if (!p95Compliant) {
      this.recordViolation({
        serviceName,
        violationType: 'latency_p95',
        targetValue: target.p95LatencyMs,
        actualValue: measurement.p95Latency,
        severity: measurement.p95Latency > target.p95LatencyMs * 1.5 ? 'critical' : 'warning',
        timestamp: measurement.timestamp,
      });
    }

    if (!p99Compliant) {
      this.recordViolation({
        serviceName,
        violationType: 'latency_p99',
        targetValue: target.p99LatencyMs,
        actualValue: measurement.p99Latency,
        severity: measurement.p99Latency > target.p99LatencyMs * 1.5 ? 'critical' : 'warning',
        timestamp: measurement.timestamp,
      });
    }

    if (!errorCompliant) {
      this.recordViolation({
        serviceName,
        violationType: 'errorRate',
        targetValue: target.errorRatePercent,
        actualValue: measurement.errorRate,
        severity: measurement.errorRate > target.errorRatePercent * 2 ? 'critical' : 'warning',
        timestamp: measurement.timestamp,
      });
    }

    const compliance: SLACompliance = {
      serviceName,
      target,
      measurement,
      uptime: {
        value: measurement.uptime,
        target: target.uptimePercent,
        compliant: uptimeCompliant,
        remainingBudgetMinutes,
      },
      latency: {
        p95: {
          value: measurement.p95Latency,
          target: target.p95LatencyMs,
          compliant: p95Compliant,
        },
        p99: {
          value: measurement.p99Latency,
          target: target.p99LatencyMs,
          compliant: p99Compliant,
        },
      },
      errorRate: {
        value: measurement.errorRate,
        target: target.errorRatePercent,
        compliant: errorCompliant,
      },
      overall: {
        compliant: violationCount === 0,
        compliancePercent,
        violationCount,
      },
      timestamp: measurement.timestamp,
    };

    return compliance;
  }

  /**
   * Record an SLA violation
   */
  private recordViolation(violation: SLAViolation): void {
    this.violations.push(violation);

    this.logger.warn(
      {
        serviceName: violation.serviceName,
        type: violation.violationType,
        target: violation.targetValue,
        actual: violation.actualValue,
        severity: violation.severity,
      },
      'SLA violation detected'
    );
  }

  /**
   * Get all violations for a service
   */
  getViolations(serviceName?: string, since?: number): SLAViolation[] {
    let violations = this.violations;

    if (serviceName) {
      violations = violations.filter(v => v.serviceName === serviceName);
    }

    if (since) {
      violations = violations.filter(v => v.timestamp >= since);
    }

    return violations;
  }

  /**
   * Get compliance summary for all services
   */
  getComplianceSummary(): {
    totalServices: number;
    compliantServices: number;
    nonCompliantServices: number;
    compliancePercent: number;
    criticalViolations: number;
    warningViolations: number;
    services: SLACompliance[];
  } {
    const compliances: SLACompliance[] = [];

    for (const serviceName of this.targets.keys()) {
      const compliance = this.getCompliance(serviceName);
      if (compliance) {
        compliances.push(compliance);
      }
    }

    const compliant = compliances.filter(c => c.overall.compliant).length;
    const criticalViolations = this.violations.filter(v => v.severity === 'critical').length;
    const warningViolations = this.violations.filter(v => v.severity === 'warning').length;

    return {
      totalServices: compliances.length,
      compliantServices: compliant,
      nonCompliantServices: compliances.length - compliant,
      compliancePercent: compliances.length > 0 ? (compliant / compliances.length) * 100 : 0,
      criticalViolations,
      warningViolations,
      services: compliances,
    };
  }

  /**
   * Export compliance report as JSON
   */
  exportComplianceReport(): string {
    const summary = this.getComplianceSummary();
    return JSON.stringify(summary, null, 2);
  }

  /**
   * Export compliance report as CSV
   */
  exportComplianceCSV(): string {
    const summary = this.getComplianceSummary();

    const headers = [
      'Service',
      'Overall Compliant',
      'Uptime',
      'Uptime Target',
      'Uptime Compliant',
      'P95 Latency (ms)',
      'P95 Target (ms)',
      'P95 Compliant',
      'P99 Latency (ms)',
      'P99 Target (ms)',
      'P99 Compliant',
      'Error Rate (%)',
      'Error Rate Target (%)',
      'Error Compliant',
      'Compliance %',
      'Violations',
    ];

    const rows = summary.services.map(c => [
      c.serviceName,
      c.overall.compliant ? 'Yes' : 'No',
      c.uptime.value.toFixed(2),
      c.uptime.target.toFixed(2),
      c.uptime.compliant ? 'Yes' : 'No',
      c.latency.p95.value.toFixed(2),
      c.latency.p95.target.toFixed(2),
      c.latency.p95.compliant ? 'Yes' : 'No',
      c.latency.p99.value.toFixed(2),
      c.latency.p99.target.toFixed(2),
      c.latency.p99.compliant ? 'Yes' : 'No',
      c.errorRate.value.toFixed(2),
      c.errorRate.target.toFixed(2),
      c.errorRate.compliant ? 'Yes' : 'No',
      c.overall.compliancePercent.toFixed(1),
      c.overall.violationCount,
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  /**
   * Print formatted SLA report
   */
  printReport(): void {
    const summary = this.getComplianceSummary();

    console.log(`
╔════════════════════════════════════════════════════════════╗
║         OrbitalMind SLA Compliance Report                 ║
╚════════════════════════════════════════════════════════════╝

📊 Summary:
   Total Services: ${summary.totalServices}
   Compliant: ${summary.compliantServices}/${summary.totalServices}
   Compliance Rate: ${summary.compliancePercent.toFixed(1)}%
   Critical Violations: ${summary.criticalViolations}
   Warning Violations: ${summary.warningViolations}

🎯 Service Compliance:
${summary.services
  .map(c => {
    const status = c.overall.compliant ? '✓' : '✗';
    return `
   ${status} ${c.serviceName}
      Overall: ${c.overall.compliant ? 'COMPLIANT' : 'NON-COMPLIANT'}
      Uptime: ${c.uptime.value.toFixed(2)}% (target: ${c.uptime.target}%) ${c.uptime.compliant ? '✓' : '✗'}
      P95 Latency: ${c.latency.p95.value.toFixed(0)}ms (target: ${c.latency.p95.target}ms) ${c.latency.p95.compliant ? '✓' : '✗'}
      P99 Latency: ${c.latency.p99.value.toFixed(0)}ms (target: ${c.latency.p99.target}ms) ${c.latency.p99.compliant ? '✓' : '✗'}
      Error Rate: ${c.errorRate.value.toFixed(2)}% (target: ${c.errorRate.target}%) ${c.errorRate.compliant ? '✓' : '✗'}
      Violations: ${c.overall.violationCount}`;
  })
  .join('\n')}

⏰ Generated: ${new Date().toISOString()}
    `);
  }

  /**
   * Clear old measurements (older than window size)
   */
  clearOldMeasurements(daysToKeep: number = 7): number {
    let cleared = 0;
    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);

    for (const measurements of this.measurements.values()) {
      const initialLength = measurements.length;
      const filtered = measurements.filter(m => m.timestamp >= cutoffTime);
      cleared += initialLength - filtered.length;
    }

    return cleared;
  }
}

export default SLATracker;
