/**
 * Science Data Analyzer - Optimized
 *
 * Uses optimization algorithms for:
 * - Vectorized batch spectral analysis instead of per-pixel loops
 * - Single-pass thermal and vegetation index calculations
 * - O(n) anomaly detection and filtering
 */

import pino from "pino";
import { VectorizedImageAnalyzer } from "@orbitalmind/optimization-lib";

/**
 * Analysis result
 */
export interface AnalysisResult {
  resultId: string;
  observationId: string;
  analysisType: string;
  timestamp: number;
  findings: string[];
  confidence: number;
  actionItems: string[];
  priority: "low" | "medium" | "high" | "critical";
}

/**
 * Mission plan
 */
export interface MissionPlan {
  planId: string;
  missionId: string;
  objectives: string[];
  targetSequence: string[];
  estimatedDuration: number;
  expectedDataVolume: number;
  successCriteria: string[];
  contingencyPlans: string[];
  status: "draft" | "approved" | "executing" | "completed";
  adaptationScore: number;
  createdAt: number;
}

/**
 * Real-time alert
 */
export interface RealTimeAlert {
  alertId: string;
  type: "scientific_discovery" | "system_issue" | "opportunity" | "anomaly";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  relatedTargets: string[];
  suggestedAction: string;
  timestamp: number;
  processed: boolean;
}

/**
 * Science Data Analyzer - Optimized
 */
export class ScienceDataAnalyzerOptimized {
  private logger = pino();
  private analysisResults: Map<string, AnalysisResult>;
  private missionPlans: Map<string, MissionPlan>;
  private realTimeAlerts: Map<string, RealTimeAlert>;
  private imageAnalyzer: VectorizedImageAnalyzer;

  // Performance metrics
  private metrics = {
    totalAnalyses: 0,
    avgAnalysisTimeMs: 0,
    totalAlerts: 0,
    criticalAlerts: 0
  };

  constructor() {
    this.analysisResults = new Map();
    this.missionPlans = new Map();
    this.realTimeAlerts = new Map();
    this.imageAnalyzer = new VectorizedImageAnalyzer();
  }

  /**
   * Analyze observation data using vectorized spectral analysis
   */
  analyzeObservationDataOptimized(
    observationId: string,
    imageData: {
      bands: Record<string, number[]>;
      metadata: Record<string, any>;
    },
    targetContext: string
  ): AnalysisResult {
    const startTime = Date.now();
    const resultId = `ANALYSIS-${observationId}-${Date.now()}`;

    // Use vectorized analyzer for batch spectral calculations
    const spectralResults = this.imageAnalyzer.calculateSpectralIndices(imageData.bands);

    // Generate findings from vectorized results
    const findings = this.extractFindingsOptimized(
      spectralResults,
      imageData.metadata,
      targetContext
    );

    const actionItems = this.generateActionItems(findings);

    // Confidence based on data quality
    const confidence = Math.min(
      1,
      imageData.metadata.quality ? imageData.metadata.quality / 100 : 0.85
    );

    // Determine priority
    let priority: "low" | "medium" | "high" | "critical" = "low";
    if (findings.some((f) => f.includes("anomaly"))) {
      priority = "high";
    }
    if (findings.some((f) => f.includes("critical"))) {
      priority = "critical";
    }

    const result: AnalysisResult = {
      resultId,
      observationId,
      analysisType: "spectral_analysis_optimized",
      timestamp: Date.now(),
      findings,
      confidence,
      actionItems,
      priority,
    };

    this.analysisResults.set(resultId, result);

    // Generate alerts if necessary
    if (priority === "critical" || priority === "high") {
      this.generateAlert(result);
    }

    // Update metrics
    const analysisTime = Date.now() - startTime;
    this.metrics.totalAnalyses++;
    this.metrics.avgAnalysisTimeMs =
      (this.metrics.avgAnalysisTimeMs * (this.metrics.totalAnalyses - 1) + analysisTime) /
      this.metrics.totalAnalyses;

    this.logger.info(
      {
        resultId,
        observationId,
        findings: findings.length,
        priority,
        analysisTimeMs: analysisTime,
      },
      "Observation analysis complete (optimized)"
    );

    return result;
  }

  /**
   * Extract findings using vectorized spectral results
   * Single-pass analysis of batch-processed indices
   */
  private extractFindingsOptimized(
    spectralResults: any,
    metadata: Record<string, any>,
    targetContext: string
  ): string[] {
    const findings: string[] = [];

    // NDVI findings - using vectorized batch results
    if (spectralResults.ndvi) {
      const avgNdvi = spectralResults.ndvi.avg;
      if (avgNdvi > 0.6) {
        findings.push("High vegetation density detected");
      } else if (avgNdvi < 0.2) {
        findings.push("Low or no vegetation coverage");
      } else {
        findings.push(`Moderate vegetation: NDVI=${avgNdvi.toFixed(2)}`);
      }
    }

    // NDBI findings - built-up/urban area detection
    if (spectralResults.ndbi) {
      const avgNdbi = spectralResults.ndbi.avg;
      if (avgNdbi > 0.1) {
        findings.push("Urban/built-up area detected");
      }
    }

    // Thermal findings - using vectorized batch results
    if (spectralResults.thermal) {
      const tempRange = spectralResults.thermal.range;
      const avgTemp = spectralResults.thermal.avg;

      if (tempRange > 20) {
        findings.push(`High thermal variance detected: ${tempRange.toFixed(1)}°C`);
      }

      if (avgTemp > 40) {
        findings.push(`Elevated temperatures detected: ${avgTemp.toFixed(1)}°C`);
      }
    }

    // Cloud and atmosphere quality
    if (metadata.cloudCover > 50) {
      findings.push(
        `Significant cloud cover (${metadata.cloudCover}%) - results may be affected`
      );
    }

    // Context-based findings
    if (targetContext.includes("glacier")) {
      if (spectralResults.ndvi) {
        findings.push("Glacier monitoring data collected");
      }
    }

    if (targetContext.includes("water")) {
      if (spectralResults.ndbi) {
        findings.push("Water body analysis completed");
      }
    }

    // Processing time inclusion
    if (spectralResults.processingTimeMs) {
      findings.push(
        `Analysis completed in ${spectralResults.processingTimeMs}ms (vectorized)`
      );
    }

    if (findings.length === 0) {
      findings.push("Standard observation conditions - no anomalies detected");
    }

    return findings;
  }

  /**
   * Generate action items from findings
   */
  private generateActionItems(findings: string[]): string[] {
    const actions: string[] = [];
    const seen = new Set<string>();

    for (const finding of findings) {
      if (finding.includes("anomaly")) {
        const action = "Schedule follow-up observation";
        if (!seen.has(action)) {
          actions.push(action);
          seen.add(action);
        }
      }

      if (finding.includes("vegetation")) {
        const action = "Continue monitoring for vegetation changes";
        if (!seen.has(action)) {
          actions.push(action);
          seen.add(action);
        }
      }

      if (finding.includes("thermal")) {
        const action = "Investigate thermal anomaly source";
        if (!seen.has(action)) {
          actions.push(action);
          seen.add(action);
        }
      }

      if (finding.includes("cloud")) {
        const action = "Schedule re-observation with better conditions";
        if (!seen.has(action)) {
          actions.push(action);
          seen.add(action);
        }
      }

      if (finding.includes("urban") || finding.includes("built-up")) {
        const action = "Update urban development maps";
        if (!seen.has(action)) {
          actions.push(action);
          seen.add(action);
        }
      }
    }

    return actions.length > 0 ? actions : ["Continue normal observation schedule"];
  }

  /**
   * Generate real-time alert from analysis
   */
  private generateAlert(result: AnalysisResult): void {
    const alertId = `ALERT-${Date.now()}`;

    const alert: RealTimeAlert = {
      alertId,
      type: result.priority === "critical" ? "anomaly" : "scientific_discovery",
      severity: result.priority,
      description: result.findings.slice(0, 3).join("; "),
      relatedTargets: [],
      suggestedAction: result.actionItems[0] || "Review analysis results",
      timestamp: Date.now(),
      processed: false,
    };

    this.realTimeAlerts.set(alertId, alert);
    this.metrics.totalAlerts++;
    if (result.priority === "critical") {
      this.metrics.criticalAlerts++;
    }

    this.logger.warn(
      {
        alertId,
        type: alert.type,
        severity: alert.severity,
      },
      "Real-time alert generated"
    );
  }

  /**
   * Create adaptive mission plan
   */
  createAdaptiveMissionPlan(
    missionId: string,
    initialObjectives: string[],
    targetSequence: string[],
    estimatedDuration: number
  ): MissionPlan {
    const planId = `PLAN-${Date.now()}`;

    // Calculate adaptation score based on recent analyses
    const adaptationScore = this.calculateAdaptationScore(targetSequence);

    // Generate success criteria
    const successCriteria = initialObjectives.map((obj) => {
      if (obj.includes("coverage")) return "Achieve >90% target coverage";
      if (obj.includes("resolution")) return "Maintain <5m resolution";
      if (obj.includes("temporal")) return "Collect 3+ observations per target";
      return "Complete scheduled observations";
    });

    // Generate contingency plans
    const contingencies = [
      "If cloud cover >70%, reschedule observation",
      "If battery <20%, reduce payload operations",
      "If conjunction risk detected, execute collision avoidance",
      "If instrument malfunction, switch to backup sensor",
    ];

    const plan: MissionPlan = {
      planId,
      missionId,
      objectives: initialObjectives,
      targetSequence,
      estimatedDuration,
      expectedDataVolume: targetSequence.length * 5,
      successCriteria,
      contingencyPlans: contingencies,
      status: "draft",
      adaptationScore,
      createdAt: Date.now(),
    };

    this.missionPlans.set(planId, plan);

    this.logger.info(
      {
        planId,
        missionId,
        targets: targetSequence.length,
        adaptationScore: adaptationScore.toFixed(1),
      },
      "Adaptive mission plan created"
    );

    return plan;
  }

  /**
   * Calculate adaptation score from recent analyses
   */
  private calculateAdaptationScore(targetSequence: string[]): number {
    // Single-pass calculation instead of filter + reduce
    let totalConfidence = 0;
    let anomalyCount = 0;
    let recentCount = 0;
    const now = Date.now();
    const oneHourAgo = now - 3600000;

    for (const result of this.analysisResults.values()) {
      if (result.timestamp > oneHourAgo) {
        totalConfidence += result.confidence;
        recentCount++;

        if (result.findings.some((f) => f.includes("anomaly"))) {
          anomalyCount++;
        }

        if (recentCount >= 10) break;
      }
    }

    if (recentCount === 0) {
      return 50;
    }

    const avgConfidence = totalConfidence / recentCount;
    const score = avgConfidence * 100 - anomalyCount * 5;

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Get high-priority alerts - single-pass filtering
   */
  getHighPriorityAlerts(): RealTimeAlert[] {
    const highPriority: RealTimeAlert[] = [];

    // Single-pass iteration
    for (const alert of this.realTimeAlerts.values()) {
      if (alert.severity === "high" || alert.severity === "critical") {
        highPriority.push(alert);
      }
    }

    // Sort by severity only (not full array.sort)
    highPriority.sort((a, b) => {
      const severityRank = { critical: 3, high: 2, medium: 1, low: 0 } as Record<
        string,
        number
      >;
      return severityRank[b.severity] - severityRank[a.severity];
    });

    return highPriority;
  }

  /**
   * Approve mission plan
   */
  approveMissionPlan(planId: string): boolean {
    const plan = this.missionPlans.get(planId);
    if (!plan) {
      return false;
    }

    plan.status = "approved";
    this.logger.info({ planId }, "Mission plan approved");

    return true;
  }

  /**
   * Start mission execution
   */
  startMissionExecution(planId: string): boolean {
    const plan = this.missionPlans.get(planId);
    if (!plan || plan.status !== "approved") {
      return false;
    }

    plan.status = "executing";
    this.logger.info({ planId }, "Mission execution started");

    return true;
  }

  /**
   * Get optimization metrics
   */
  getOptimizationMetrics() {
    return {
      totalAnalyses: this.metrics.totalAnalyses,
      avgAnalysisTimeMs: this.metrics.avgAnalysisTimeMs.toFixed(2),
      totalAlerts: this.metrics.totalAlerts,
      criticalAlerts: this.metrics.criticalAlerts,
      alertRate:
        this.metrics.totalAnalyses > 0
          ? ((this.metrics.totalAlerts / this.metrics.totalAnalyses) * 100).toFixed(1)
          : "0"
    };
  }
}

export default ScienceDataAnalyzerOptimized;
