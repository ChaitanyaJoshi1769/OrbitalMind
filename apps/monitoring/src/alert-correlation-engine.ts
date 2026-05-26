/**
 * OrbitalMind Alert Correlation Engine
 *
 * Groups related alerts across services and detects patterns
 * to identify root causes and suggest correlations
 */

import pino from 'pino';

/**
 * Alert for correlation
 */
export interface CorrelationAlert {
  alertId: string;
  serviceName: string;
  metricName: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  timestamp: number;
  value: number;
  threshold: number;
  tags?: string[];
}

/**
 * Correlation pattern
 */
export interface CorrelationPattern {
  patternId: string;
  name: string;
  description: string;
  alerts: string[]; // Alert IDs
  services: string[];
  timestamp: number;
  strength: number; // 0-1, correlation strength
  suggestedRootCause?: string;
  autoGrouped: boolean;
}

/**
 * Service dependency
 */
export interface ServiceDependency {
  source: string;
  target: string;
  dependencyType: 'direct' | 'data-flow' | 'performance' | 'resource';
  criticality: 'critical' | 'high' | 'medium' | 'low';
}

/**
 * Metric correlation
 */
export interface MetricCorrelation {
  metric1: string;
  metric2: string;
  correlationCoefficient: number;
  strength: 'strong' | 'moderate' | 'weak';
}

/**
 * Alert Correlation Engine
 */
export class AlertCorrelationEngine {
  private logger = pino();
  private alerts: Map<string, CorrelationAlert> = new Map();
  private patterns: Map<string, CorrelationPattern> = new Map();
  private serviceDependencies: ServiceDependency[] = [];
  private metricCorrelations: MetricCorrelation[] = [];
  private patternCounter = 1000;
  private windowSize = 300000; // 5 minutes default

  constructor() {
    this.setupDefaultDependencies();
    this.setupMetricCorrelations();
  }

  /**
   * Set up default service dependencies
   */
  private setupDefaultDependencies(): void {
    // Define critical service dependencies in OrbitalMind
    this.serviceDependencies = [
      {
        source: 'space-traffic',
        target: 'orbital-networking',
        dependencyType: 'data-flow',
        criticality: 'critical',
      },
      {
        source: 'orbital-networking',
        target: 'digital-twin',
        dependencyType: 'data-flow',
        criticality: 'critical',
      },
      {
        source: 'thermal-engine',
        target: 'power-management',
        dependencyType: 'resource',
        criticality: 'critical',
      },
      {
        source: 'inference-runtime',
        target: 'edge-compute',
        dependencyType: 'data-flow',
        criticality: 'high',
      },
      {
        source: 'blockchain',
        target: 'federation-hub',
        dependencyType: 'data-flow',
        criticality: 'high',
      },
      {
        source: 'radiation-runtime',
        target: 'control-plane',
        dependencyType: 'performance',
        criticality: 'high',
      },
    ];

    this.logger.info('Default service dependencies configured');
  }

  /**
   * Set up metric correlations
   */
  private setupMetricCorrelations(): void {
    // Known metric correlations
    this.metricCorrelations = [
      {
        metric1: 'avgResponseTime',
        metric2: 'errorRate',
        correlationCoefficient: 0.85,
        strength: 'strong',
      },
      {
        metric1: 'temperature',
        metric2: 'powerUsage',
        correlationCoefficient: 0.9,
        strength: 'strong',
      },
      {
        metric1: 'routingTime',
        metric2: 'linkUtilization',
        correlationCoefficient: 0.72,
        strength: 'moderate',
      },
      {
        metric1: 'cacheHitRate',
        metric2: 'queryTime',
        correlationCoefficient: -0.88,
        strength: 'strong',
      },
      {
        metric1: 'compressionRatio',
        metric2: 'communicationSavings',
        correlationCoefficient: 0.95,
        strength: 'strong',
      },
    ];

    this.logger.info('Metric correlations configured');
  }

  /**
   * Add alert for correlation analysis
   */
  addAlert(alert: CorrelationAlert): void {
    this.alerts.set(alert.alertId, alert);

    // Automatically trigger correlation analysis
    this.analyzeCorrelations();
  }

  /**
   * Analyze correlations in alerts
   */
  analyzeCorrelations(): CorrelationPattern[] {
    const newPatterns: CorrelationPattern[] = [];
    const now = Date.now();
    const windowStart = now - this.windowSize;

    // Get recent alerts
    const recentAlerts = Array.from(this.alerts.values()).filter(
      (a) => a.timestamp >= windowStart
    );

    // Find alerts with correlated metrics
    for (let i = 0; i < recentAlerts.length; i++) {
      for (let j = i + 1; j < recentAlerts.length; j++) {
        const alert1 = recentAlerts[i];
        const alert2 = recentAlerts[j];

        // Check if metrics are correlated
        const correlation = this.metricCorrelations.find(
          (c) =>
            (c.metric1 === alert1.metricName && c.metric2 === alert2.metricName) ||
            (c.metric1 === alert2.metricName && c.metric2 === alert1.metricName)
        );

        if (correlation && correlation.strength === 'strong') {
          // Check for time proximity (within 10 seconds)
          if (Math.abs(alert1.timestamp - alert2.timestamp) < 10000) {
            const pattern = this.createCorrelationPattern(
              [alert1, alert2],
              correlation.correlationCoefficient,
              true
            );

            newPatterns.push(pattern);
          }
        }
      }
    }

    // Find alerts across dependent services
    for (const dependency of this.serviceDependencies) {
      const sourceAlerts = recentAlerts.filter((a) => a.serviceName === dependency.source);
      const targetAlerts = recentAlerts.filter((a) => a.serviceName === dependency.target);

      if (
        sourceAlerts.length > 0 &&
        targetAlerts.length > 0 &&
        dependency.criticality === 'critical'
      ) {
        // Check for temporal relationship (source alerts should precede target)
        for (const sourceAlert of sourceAlerts) {
          for (const targetAlert of targetAlerts) {
            if (
              sourceAlert.timestamp < targetAlert.timestamp &&
              targetAlert.timestamp - sourceAlert.timestamp < 30000
            ) {
              const pattern = this.createCorrelationPattern(
                [sourceAlert, targetAlert],
                0.8,
                true,
                `${dependency.source} → ${dependency.target} cascade`
              );

              newPatterns.push(pattern);
            }
          }
        }
      }
    }

    // Find severity patterns
    const criticalAlerts = recentAlerts.filter((a) => a.severity === 'critical');
    if (criticalAlerts.length >= 3) {
      const pattern = this.createCorrelationPattern(
        criticalAlerts,
        0.9,
        true,
        'Multiple critical alerts - possible systemic issue'
      );

      newPatterns.push(pattern);
    }

    // Store new patterns
    for (const pattern of newPatterns) {
      this.patterns.set(pattern.patternId, pattern);
    }

    this.logger.info(
      { patternsFound: newPatterns.length, totalPatterns: this.patterns.size },
      'Correlation analysis completed'
    );

    return newPatterns;
  }

  /**
   * Create correlation pattern
   */
  private createCorrelationPattern(
    alerts: CorrelationAlert[],
    strength: number,
    autoGrouped: boolean,
    suggestedRootCause?: string
  ): CorrelationPattern {
    const patternId = `PATTERN-${this.patternCounter++}`;
    const services = Array.from(new Set(alerts.map((a) => a.serviceName)));

    return {
      patternId,
      name: `Correlated Alert Group ${this.patternCounter}`,
      description: `${alerts.length} alerts across ${services.length} services`,
      alerts: alerts.map((a) => a.alertId),
      services,
      timestamp: Date.now(),
      strength: Math.min(strength, 1),
      suggestedRootCause,
      autoGrouped,
    };
  }

  /**
   * Get pattern by ID
   */
  getPattern(patternId: string): CorrelationPattern | undefined {
    return this.patterns.get(patternId);
  }

  /**
   * Get all patterns
   */
  getAllPatterns(): CorrelationPattern[] {
    return Array.from(this.patterns.values());
  }

  /**
   * Get patterns for service
   */
  getPatternsByService(serviceName: string): CorrelationPattern[] {
    return Array.from(this.patterns.values()).filter((p) =>
      p.services.includes(serviceName)
    );
  }

  /**
   * Get patterns by strength
   */
  getPatternsByStrength(minStrength: number): CorrelationPattern[] {
    return Array.from(this.patterns.values()).filter((p) => p.strength >= minStrength);
  }

  /**
   * Analyze impact of alert
   */
  analyzeAlertImpact(alertId: string): {
    directlyAffected: string[];
    potentiallyAffected: string[];
    estimatedSeverity: 'critical' | 'high' | 'medium' | 'low';
  } {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      return {
        directlyAffected: [],
        potentiallyAffected: [],
        estimatedSeverity: 'low',
      };
    }

    const directlyAffected: Set<string> = new Set();
    directlyAffected.add(alert.serviceName);

    // Find directly dependent services
    const directDependents = this.serviceDependencies
      .filter((d) => d.source === alert.serviceName)
      .map((d) => d.target);

    directlyAffected.forEach((service) => {
      directDependents.forEach((dependent) => directlyAffected.add(dependent));
    });

    // Find potentially affected services (2 hops away)
    const potentiallyAffected: Set<string> = new Set();
    for (const service of directlyAffected) {
      const dependencies = this.serviceDependencies
        .filter((d) => d.source === service)
        .map((d) => d.target);

      dependencies.forEach((d) => {
        if (!directlyAffected.has(d)) {
          potentiallyAffected.add(d);
        }
      });
    }

    // Estimate severity based on alert level and affected services
    let estimatedSeverity: 'critical' | 'high' | 'medium' | 'low' = alert.severity as any;
    if (directlyAffected.size >= 3) {
      estimatedSeverity = 'critical';
    } else if (estimatedSeverity === 'warning' && directlyAffected.size >= 2) {
      estimatedSeverity = 'critical';
    }

    return {
      directlyAffected: Array.from(directlyAffected),
      potentiallyAffected: Array.from(potentiallyAffected),
      estimatedSeverity,
    };
  }

  /**
   * Predict cascade failures
   */
  predictCascadeFailures(serviceName: string): {
    affectedServices: Array<{
      service: string;
      probability: number;
      timeToImpact: number; // estimated milliseconds
    }>;
  } {
    const affectedServices = [];

    // Find dependent services
    const directDependents = this.serviceDependencies
      .filter((d) => d.source === serviceName && d.criticality === 'critical')
      .map((d) => d.target);

    for (const dependent of directDependents) {
      affectedServices.push({
        service: dependent,
        probability: 0.9,
        timeToImpact: 5000, // 5 seconds
      });

      // Find second-level dependents
      const secondLevel = this.serviceDependencies
        .filter((d) => d.source === dependent && d.criticality === 'critical')
        .map((d) => d.target);

      for (const secondDep of secondLevel) {
        affectedServices.push({
          service: secondDep,
          probability: 0.7,
          timeToImpact: 15000, // 15 seconds
        });
      }
    }

    return { affectedServices };
  }

  /**
   * Get related alerts
   */
  getRelatedAlerts(alertId: string, withinMinutes: number = 5): CorrelationAlert[] {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      return [];
    }

    const windowStart = alert.timestamp - withinMinutes * 60 * 1000;
    const windowEnd = alert.timestamp + withinMinutes * 60 * 1000;

    return Array.from(this.alerts.values())
      .filter(
        (a) =>
          a.alertId !== alertId &&
          a.timestamp >= windowStart &&
          a.timestamp <= windowEnd &&
          (a.serviceName === alert.serviceName ||
            this.areServicesRelated(alert.serviceName, a.serviceName))
      )
      .sort((a, b) => Math.abs(a.timestamp - alert.timestamp) - Math.abs(b.timestamp - alert.timestamp));
  }

  /**
   * Check if services are related
   */
  private areServicesRelated(service1: string, service2: string): boolean {
    const dependency = this.serviceDependencies.find(
      (d) =>
        (d.source === service1 && d.target === service2) ||
        (d.source === service2 && d.target === service1)
    );

    return !!dependency;
  }

  /**
   * Get service dependency graph
   */
  getDependencyGraph(): {
    nodes: Array<{ id: string; label: string }>;
    edges: Array<{ from: string; to: string; type: string }>;
  } {
    const services = new Set<string>();
    const edges = [];

    for (const dependency of this.serviceDependencies) {
      services.add(dependency.source);
      services.add(dependency.target);
      edges.push({
        from: dependency.source,
        to: dependency.target,
        type: dependency.dependencyType,
      });
    }

    return {
      nodes: Array.from(services).map((service) => ({
        id: service,
        label: service,
      })),
      edges,
    };
  }

  /**
   * Get correlation statistics
   */
  getStatistics(): {
    totalAlerts: number;
    totalPatterns: number;
    averageAlertCorrelation: number;
    strongCorrelations: number;
    detectedCascades: number;
  } {
    const patterns = Array.from(this.patterns.values());

    const totalAlerts = this.alerts.size;
    const totalPatterns = patterns.length;
    const averageAlertCorrelation =
      patterns.length > 0
        ? patterns.reduce((sum, p) => sum + p.strength, 0) / patterns.length
        : 0;
    const strongCorrelations = patterns.filter((p) => p.strength > 0.8).length;
    const detectedCascades = patterns.filter((p) =>
      p.suggestedRootCause?.includes('cascade')
    ).length;

    return {
      totalAlerts,
      totalPatterns,
      averageAlertCorrelation,
      strongCorrelations,
      detectedCascades,
    };
  }

  /**
   * Clear old alerts and patterns
   */
  cleanup(olderThanMinutes: number = 60): number {
    const cutoffTime = Date.now() - olderThanMinutes * 60 * 1000;

    let removed = 0;

    // Remove old alerts
    for (const [alertId, alert] of this.alerts.entries()) {
      if (alert.timestamp < cutoffTime) {
        this.alerts.delete(alertId);
        removed++;
      }
    }

    // Remove patterns referencing deleted alerts
    for (const [patternId, pattern] of this.patterns.entries()) {
      const referencesDeletedAlert = pattern.alerts.some(
        (alertId) => !this.alerts.has(alertId)
      );

      if (referencesDeletedAlert) {
        this.patterns.delete(patternId);
      }
    }

    this.logger.info({ removed }, 'Cleaned up old alerts and patterns');

    return removed;
  }
}

export default AlertCorrelationEngine;
