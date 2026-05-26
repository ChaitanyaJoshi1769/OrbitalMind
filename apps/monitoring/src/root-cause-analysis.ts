/**
 * OrbitalMind Root Cause Analysis
 *
 * Machine learning-based root cause analysis for incidents
 * and service degradation with probabilistic reasoning
 */

import pino from 'pino';

/**
 * Root cause hypothesis
 */
export interface RootCauseHypothesis {
  causeId: string;
  description: string;
  probability: number; // 0-1
  affectedServices: string[];
  supportingEvidence: string[];
  timeToImpact: number; // milliseconds
  remediationSteps: string[];
}

/**
 * Root cause analysis result
 */
export interface RootCauseAnalysis {
  incidentId: string;
  timestamp: number;
  affectedServices: string[];
  symptoms: string[];
  hypotheses: RootCauseHypothesis[];
  mostLikelyCause?: RootCauseHypothesis;
  analysisConfidence: number; // 0-1
  suggestedActions: string[];
}

/**
 * Service component
 */
export interface ServiceComponent {
  serviceName: string;
  componentName: string;
  dependencies: string[];
  criticalityLevel: 'critical' | 'high' | 'medium' | 'low';
  failureImpact: string[];
}

/**
 * Root Cause Analysis Engine
 */
export class RootCauseAnalysisEngine {
  private logger = pino();
  private analysisHistory: RootCauseAnalysis[] = [];
  private knownCauses: Map<string, RootCauseHypothesis> = new Map();
  private serviceComponents: Map<string, ServiceComponent[]> = new Map();
  private correlationHistory: Array<{
    timestamp: number;
    cause: string;
    effect: string;
    probability: number;
  }> = [];

  constructor() {
    this.setupKnownCauses();
    this.setupServiceComponents();
    this.logger.info('Root Cause Analysis Engine initialized');
  }

  /**
   * Set up known causes library
   */
  private setupKnownCauses(): void {
    const commonCauses = [
      {
        causeId: 'resource-exhaustion',
        description: 'CPU, memory, or disk resource exhaustion',
        affectedServices: [
          'inference-runtime',
          'thermal-engine',
          'blockchain',
          'edge-compute',
        ],
        remediationSteps: [
          'Check resource utilization',
          'Scale up resources',
          'Identify resource leak',
          'Kill or restart consuming process',
        ],
      },
      {
        causeId: 'cascading-failure',
        description: 'Failure in upstream service causing downstream impact',
        affectedServices: [
          'space-traffic',
          'orbital-networking',
          'digital-twin',
          'control-plane',
        ],
        remediationSteps: [
          'Identify upstream failure',
          'Restore upstream service',
          'Drain and restart downstream',
          'Verify circuit breakers',
        ],
      },
      {
        causeId: 'configuration-error',
        description: 'Invalid or corrupted configuration deployment',
        affectedServices: ['all'],
        remediationSteps: [
          'Review recent configuration changes',
          'Revert to last known good config',
          'Validate configuration schema',
          'Deploy corrected configuration',
        ],
      },
      {
        causeId: 'database-issue',
        description: 'Database connection pool exhaustion or query timeout',
        affectedServices: ['blockchain', 'science-ops', 'federation-hub'],
        remediationSteps: [
          'Check database connectivity',
          'Review slow query logs',
          'Verify connection pool settings',
          'Kill long-running queries',
          'Restart connection pool',
        ],
      },
      {
        causeId: 'network-latency',
        description: 'Increased network latency or packet loss',
        affectedServices: [
          'orbital-networking',
          'space-traffic',
          'federation-hub',
          'digital-twin',
        ],
        remediationSteps: [
          'Check network metrics',
          'Identify network congestion',
          'Adjust routing',
          'Scale network capacity',
        ],
      },
      {
        causeId: 'external-dependency',
        description: 'Third-party service or external API failure',
        affectedServices: ['all'],
        remediationSteps: [
          'Check external service status',
          'Verify API endpoints',
          'Review retry policies',
          'Implement fallback behavior',
        ],
      },
    ];

    for (const cause of commonCauses) {
      this.knownCauses.set(cause.causeId, {
        causeId: cause.causeId,
        description: cause.description,
        probability: 0,
        affectedServices: cause.affectedServices,
        supportingEvidence: [],
        timeToImpact: 0,
        remediationSteps: cause.remediationSteps,
      });
    }

    this.logger.info(`Loaded ${commonCauses.length} known root causes`);
  }

  /**
   * Set up service components
   */
  private setupServiceComponents(): void {
    const components: Record<string, ServiceComponent[]> = {
      'space-traffic': [
        {
          serviceName: 'space-traffic',
          componentName: 'traffic-controller',
          dependencies: ['orbital-networking', 'digital-twin'],
          criticalityLevel: 'critical',
          failureImpact: ['orbital-networking', 'digital-twin'],
        },
        {
          serviceName: 'space-traffic',
          componentName: 'prediction-engine',
          dependencies: ['inference-runtime'],
          criticalityLevel: 'high',
          failureImpact: ['traffic-controller'],
        },
      ],
      'orbital-networking': [
        {
          serviceName: 'orbital-networking',
          componentName: 'router',
          dependencies: ['control-plane'],
          criticalityLevel: 'critical',
          failureImpact: ['all'],
        },
        {
          serviceName: 'orbital-networking',
          componentName: 'gateway',
          dependencies: ['federation-hub'],
          criticalityLevel: 'high',
          failureImpact: ['federation-hub'],
        },
      ],
      blockchain: [
        {
          serviceName: 'blockchain',
          componentName: 'ledger',
          dependencies: [],
          criticalityLevel: 'critical',
          failureImpact: ['federation-hub'],
        },
        {
          serviceName: 'blockchain',
          componentName: 'validator',
          dependencies: ['control-plane'],
          criticalityLevel: 'high',
          failureImpact: ['ledger'],
        },
      ],
    };

    for (const [service, comps] of Object.entries(components)) {
      this.serviceComponents.set(service, comps);
    }
  }

  /**
   * Analyze root causes
   */
  analyzeRootCauses(
    incidentId: string,
    affectedServices: string[],
    symptoms: string[],
    metrics: Record<string, number>,
    correlations: Array<{ service1: string; service2: string; strength: number }>
  ): RootCauseAnalysis {
    const hypotheses: RootCauseHypothesis[] = [];

    // Score each known cause
    for (const [causeId, baseCause] of this.knownCauses) {
      const probability = this.calculateCauseProbability(
        baseCause,
        affectedServices,
        symptoms,
        metrics,
        correlations
      );

      if (probability > 0.1) {
        const evidence = this.gatherSupportingEvidence(
          causeId,
          affectedServices,
          symptoms,
          metrics,
          correlations
        );

        hypotheses.push({
          causeId,
          description: baseCause.description,
          probability,
          affectedServices: baseCause.affectedServices.filter((s) =>
            affectedServices.includes(s)
          ),
          supportingEvidence: evidence,
          timeToImpact: this.estimateTimeToImpact(causeId, affectedServices),
          remediationSteps: baseCause.remediationSteps,
        });
      }
    }

    // Sort by probability
    hypotheses.sort((a, b) => b.probability - a.probability);

    // Select most likely cause
    const mostLikelyCause = hypotheses.length > 0 ? hypotheses[0] : undefined;
    const analysisConfidence = hypotheses.length > 0 ? hypotheses[0].probability : 0;

    // Generate suggested actions
    const suggestedActions = this.generateActions(hypotheses, affectedServices);

    const analysis: RootCauseAnalysis = {
      incidentId,
      timestamp: Date.now(),
      affectedServices,
      symptoms,
      hypotheses,
      mostLikelyCause,
      analysisConfidence,
      suggestedActions,
    };

    this.analysisHistory.push(analysis);

    // Keep only recent analyses
    const cutoffTime = Date.now() - 30 * 24 * 60 * 60 * 1000;
    this.analysisHistory = this.analysisHistory.filter((a) => a.timestamp > cutoffTime);

    this.logger.info(
      {
        incidentId,
        affectedServices,
        mostLikelyCause: mostLikelyCause?.causeId,
        confidence: (analysisConfidence * 100).toFixed(1),
      },
      'Root cause analysis complete'
    );

    return analysis;
  }

  /**
   * Calculate cause probability
   */
  private calculateCauseProbability(
    cause: RootCauseHypothesis,
    affectedServices: string[],
    symptoms: string[],
    metrics: Record<string, number>,
    correlations: Array<{ service1: string; service2: string; strength: number }>
  ): number {
    let probability = 0.2; // Base probability

    // Service match
    const matchingServices = cause.affectedServices.filter((s) => affectedServices.includes(s));
    const serviceScore = matchingServices.length / affectedServices.length;
    probability += serviceScore * 0.3;

    // Symptom match (heuristic)
    let symptomMatches = 0;
    if (
      cause.causeId === 'resource-exhaustion' &&
      symptoms.some((s) => s.includes('latency') || s.includes('timeout'))
    ) {
      symptomMatches++;
    }
    if (
      cause.causeId === 'cascading-failure' &&
      symptoms.some((s) => s.includes('error') || s.includes('connection'))
    ) {
      symptomMatches++;
    }
    if (
      cause.causeId === 'network-latency' &&
      symptoms.some((s) => s.includes('latency') || s.includes('throughput'))
    ) {
      symptomMatches++;
    }

    const symptomScore = Math.min(1, symptomMatches * 0.3);
    probability += symptomScore * 0.3;

    // Metric-based scoring
    if (
      cause.causeId === 'resource-exhaustion' &&
      (metrics.cpuUsage || 0) > 80
    ) {
      probability += 0.2;
    }
    if (
      cause.causeId === 'network-latency' &&
      (metrics.networkLatency || 0) > 100
    ) {
      probability += 0.2;
    }

    // Correlation strength
    const avgCorrelation =
      correlations.length > 0
        ? correlations.reduce((sum, c) => sum + c.strength, 0) / correlations.length
        : 0;

    if (avgCorrelation > 0.7) {
      probability += 0.1;
    }

    return Math.min(1, probability);
  }

  /**
   * Gather supporting evidence
   */
  private gatherSupportingEvidence(
    causeId: string,
    affectedServices: string[],
    symptoms: string[],
    metrics: Record<string, number>,
    correlations: Array<{ service1: string; service2: string; strength: number }>
  ): string[] {
    const evidence: string[] = [];

    // Service-based evidence
    for (const service of affectedServices) {
      const components = this.serviceComponents.get(service);
      if (components) {
        for (const component of components) {
          evidence.push(`Service ${service} component ${component.componentName} potentially affected`);
        }
      }
    }

    // Metric-based evidence
    for (const [metric, value] of Object.entries(metrics)) {
      if (value > 80) {
        evidence.push(`${metric} at ${value.toFixed(1)}% - elevated threshold breached`);
      }
    }

    // Correlation evidence
    for (const corr of correlations) {
      if (corr.strength > 0.7) {
        evidence.push(
          `Strong correlation (${(corr.strength * 100).toFixed(0)}%) between ${corr.service1} and ${corr.service2}`
        );
      }
    }

    // Symptom-based evidence
    evidence.push(...symptoms);

    return evidence.slice(0, 10); // Limit to 10 most relevant
  }

  /**
   * Estimate time to impact
   */
  private estimateTimeToImpact(causeId: string, affectedServices: string[]): number {
    const baseTime = 5 * 60 * 1000; // 5 minutes base

    if (causeId === 'cascading-failure') {
      return baseTime * affectedServices.length;
    }

    if (causeId === 'resource-exhaustion') {
      return baseTime * 2;
    }

    return baseTime;
  }

  /**
   * Generate suggested actions
   */
  private generateActions(
    hypotheses: RootCauseHypothesis[],
    affectedServices: string[]
  ): string[] {
    const actions: string[] = [];

    // Add remediation from top 3 hypotheses
    for (const hypothesis of hypotheses.slice(0, 3)) {
      actions.push(
        `[${hypothesis.causeId}] ${hypothesis.description}`,
        ...hypothesis.remediationSteps.slice(0, 2)
      );
    }

    // Add general actions
    actions.push(
      'Isolate affected services if cascading failure suspected',
      'Collect logs and metrics from incident window',
      'Document findings for post-incident review'
    );

    return actions.slice(0, 10); // Limit to 10 actions
  }

  /**
   * Record correlation for learning
   */
  recordCorrelation(cause: string, effect: string, probability: number): void {
    this.correlationHistory.push({
      timestamp: Date.now(),
      cause,
      effect,
      probability,
    });

    // Keep only recent correlations
    const cutoffTime = Date.now() - 90 * 24 * 60 * 60 * 1000;
    this.correlationHistory = this.correlationHistory.filter((c) => c.timestamp > cutoffTime);
  }

  /**
   * Get analysis history
   */
  getAnalysisHistory(serviceName?: string, limit: number = 50): RootCauseAnalysis[] {
    return this.analysisHistory
      .filter((a) => !serviceName || a.affectedServices.includes(serviceName))
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get analysis by incident ID
   */
  getAnalysis(incidentId: string): RootCauseAnalysis | undefined {
    return this.analysisHistory.find((a) => a.incidentId === incidentId);
  }

  /**
   * Get correlation patterns
   */
  getCorrelationPatterns(
    cause?: string,
    minProbability: number = 0.5
  ): Array<{ cause: string; effect: string; frequency: number; avgProbability: number }> {
    const patterns = new Map<string, { count: number; totalProb: number }>();

    for (const corr of this.correlationHistory) {
      if (corr.probability < minProbability) continue;
      if (cause && corr.cause !== cause) continue;

      const key = `${corr.cause}→${corr.effect}`;
      const existing = patterns.get(key) || { count: 0, totalProb: 0 };
      existing.count++;
      existing.totalProb += corr.probability;
      patterns.set(key, existing);
    }

    return Array.from(patterns.entries())
      .map(([key, data]) => {
        const [cause, effect] = key.split('→');
        return {
          cause,
          effect,
          frequency: data.count,
          avgProbability: data.totalProb / data.count,
        };
      })
      .sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * Export analysis
   */
  exportAnalysis(): string {
    return JSON.stringify(
      {
        timestamp: Date.now(),
        analysisCount: this.analysisHistory.length,
        correlationPatterns: this.getCorrelationPatterns(),
        knownCauses: Array.from(this.knownCauses.values()),
      },
      null,
      2
    );
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalAnalyses: number;
    averageConfidence: number;
    mostCommonCauses: Array<{ cause: string; count: number }>;
    correlationPatternCount: number;
  } {
    const causeCounts = new Map<string, number>();

    for (const analysis of this.analysisHistory) {
      if (analysis.mostLikelyCause) {
        const count = (causeCounts.get(analysis.mostLikelyCause.causeId) || 0) + 1;
        causeCounts.set(analysis.mostLikelyCause.causeId, count);
      }
    }

    const mostCommonCauses = Array.from(causeCounts.entries())
      .map(([cause, count]) => ({ cause, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const avgConfidence =
      this.analysisHistory.length > 0
        ? this.analysisHistory.reduce((sum, a) => sum + a.analysisConfidence, 0) /
          this.analysisHistory.length
        : 0;

    return {
      totalAnalyses: this.analysisHistory.length,
      averageConfidence: avgConfidence,
      mostCommonCauses,
      correlationPatternCount: this.getCorrelationPatterns().length,
    };
  }
}

export default RootCauseAnalysisEngine;
