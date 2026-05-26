/**
 * OrbitalMind Policy Engine
 *
 * Dynamic policy management for complex rule configuration,
 * conditional logic, and behavior customization
 */

import pino from 'pino';

/**
 * Policy condition
 */
export interface PolicyCondition {
  type: 'metric' | 'symptom' | 'rule' | 'event' | 'composite';
  name: string;
  operator: '>' | '<' | '=' | '!=' | 'in' | 'contains' | 'matches' | 'and' | 'or' | 'not';
  value?: any;
  threshold?: number;
  children?: PolicyCondition[]; // For composite conditions
}

/**
 * Policy action
 */
export interface PolicyAction {
  type: 'alert' | 'escalate' | 'remediate' | 'notify' | 'incident' | 'custom';
  name: string;
  target?: string;
  parameters: Record<string, any>;
  priority: 'immediate' | 'high' | 'medium' | 'low';
  retryPolicy?: {
    maxRetries: number;
    backoffMultiplier: number;
    initialDelayMs: number;
  };
}

/**
 * Policy definition
 */
export interface Policy {
  policyId: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number; // Higher = more important
  scope: {
    serviceName?: string | string[];
    environment?: string;
    region?: string;
  };
  conditions: PolicyCondition[];
  actions: PolicyAction[];
  evaluationStrategy: 'first-match' | 'all-match' | 'best-match';
  cooldownMs: number; // Minimum time between triggers
  maxExecutionsPerWindow: number;
  timeWindowMs: number;
  createdAt: number;
  updatedAt: number;
  version: number;
  metadata?: Record<string, any>;
}

/**
 * Policy evaluation context
 */
export interface EvaluationContext {
  serviceName: string;
  metrics: Record<string, number>;
  symptoms: string[];
  events: Array<{ type: string; data: any; timestamp: number }>;
  timestamp: number;
}

/**
 * Policy evaluation result
 */
export interface PolicyEvaluationResult {
  policyId: string;
  matched: boolean;
  matchedConditions: PolicyCondition[];
  matchScore: number; // 0-1
  suggestedActions: PolicyAction[];
  evaluationTime: number;
}

/**
 * Policy Engine
 */
export class PolicyEngine {
  private logger = pino();
  private policies: Map<string, Policy> = new Map();
  private policyVersions: Map<string, Policy[]> = new Map();
  private evaluationHistory: Array<{
    timestamp: number;
    policyId: string;
    context: EvaluationContext;
    result: PolicyEvaluationResult;
  }> = [];
  private lastTriggerTime: Map<string, number> = new Map();
  private executionCounts: Map<string, number[]> = new Map();

  constructor() {
    this.setupDefaultPolicies();
    this.logger.info('Policy Engine initialized');
  }

  /**
   * Set up default policies
   */
  private setupDefaultPolicies(): void {
    // High CPU usage policy
    this.createPolicy({
      policyId: 'high-cpu-policy',
      name: 'High CPU Usage Alert and Remediation',
      description: 'Alert and auto-remediate when CPU usage exceeds 85%',
      enabled: true,
      priority: 100,
      scope: {
        serviceName: [
          'inference-runtime',
          'thermal-engine',
          'edge-compute',
        ],
      },
      conditions: [
        {
          type: 'metric',
          name: 'cpu-usage',
          operator: '>',
          threshold: 85,
        },
      ],
      actions: [
        {
          type: 'alert',
          name: 'cpu-threshold-alert',
          priority: 'high',
          parameters: {
            severity: 'warning',
            message: 'CPU usage above threshold',
          },
        },
        {
          type: 'remediate',
          name: 'scale-up-action',
          target: 'scale-up',
          priority: 'high',
          parameters: {
            scalePercentage: 25,
          },
        },
      ],
      evaluationStrategy: 'all-match',
      cooldownMs: 300000, // 5 minutes
      maxExecutionsPerWindow: 5,
      timeWindowMs: 3600000, // 1 hour
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    });

    // Cascading failure policy
    this.createPolicy({
      policyId: 'cascading-failure-policy',
      name: 'Cascading Failure Prevention',
      description: 'Detect and prevent cascading failures between services',
      enabled: true,
      priority: 200,
      scope: {
        serviceName: [
          'space-traffic',
          'orbital-networking',
          'digital-twin',
        ],
      },
      conditions: [
        {
          type: 'symptom',
          name: 'error-spike',
          operator: 'contains',
          value: 'error_rate',
        },
        {
          type: 'metric',
          name: 'error-rate',
          operator: '>',
          threshold: 10,
        },
      ],
      actions: [
        {
          type: 'incident',
          name: 'create-incident',
          priority: 'immediate',
          parameters: {
            severity: 'sev1',
            title: 'Cascading failure detected',
            component: 'incident-system',
          },
        },
        {
          type: 'remediate',
          name: 'circuit-breaker',
          target: 'circuit-breaker-reset',
          priority: 'immediate',
          parameters: {
            circuitName: 'cascade-protection',
          },
        },
      ],
      evaluationStrategy: 'best-match',
      cooldownMs: 600000, // 10 minutes
      maxExecutionsPerWindow: 3,
      timeWindowMs: 3600000,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    });

    // SLA violation policy
    this.createPolicy({
      policyId: 'sla-violation-policy',
      name: 'SLA Violation Response',
      description: 'Escalate and notify on SLA violations',
      enabled: true,
      priority: 150,
      scope: {},
      conditions: [
        {
          type: 'event',
          name: 'sla-violation',
          operator: 'matches',
          value: 'violation_probability > 0.7',
        },
      ],
      actions: [
        {
          type: 'escalate',
          name: 'escalate-to-management',
          priority: 'high',
          parameters: {
            escalationLevel: 2,
            recipients: ['ops-manager'],
          },
        },
        {
          type: 'incident',
          name: 'create-sla-incident',
          priority: 'high',
          parameters: {
            severity: 'sev2',
            title: 'SLA violation predicted',
          },
        },
      ],
      evaluationStrategy: 'first-match',
      cooldownMs: 300000,
      maxExecutionsPerWindow: 10,
      timeWindowMs: 3600000,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    });
  }

  /**
   * Create policy
   */
  createPolicy(policy: Policy): void {
    this.policies.set(policy.policyId, policy);

    // Track version
    if (!this.policyVersions.has(policy.policyId)) {
      this.policyVersions.set(policy.policyId, []);
    }
    this.policyVersions.get(policy.policyId)!.push({ ...policy });

    this.logger.info(
      { policyId: policy.policyId, name: policy.name },
      'Policy created'
    );
  }

  /**
   * Update policy
   */
  updatePolicy(policyId: string, updates: Partial<Policy>): void {
    const policy = this.policies.get(policyId);

    if (!policy) {
      throw new Error(`Policy not found: ${policyId}`);
    }

    const updated: Policy = {
      ...policy,
      ...updates,
      policyId,
      version: policy.version + 1,
      updatedAt: Date.now(),
    };

    this.policies.set(policyId, updated);

    // Track version
    const versions = this.policyVersions.get(policyId) || [];
    versions.push({ ...updated });
    this.policyVersions.set(policyId, versions);

    this.logger.info(
      { policyId, version: updated.version },
      'Policy updated'
    );
  }

  /**
   * Evaluate context against policy
   */
  evaluatePolicy(
    policyId: string,
    context: EvaluationContext
  ): PolicyEvaluationResult {
    const policy = this.policies.get(policyId);

    if (!policy || !policy.enabled) {
      return {
        policyId,
        matched: false,
        matchedConditions: [],
        matchScore: 0,
        suggestedActions: [],
        evaluationTime: Date.now(),
      };
    }

    // Check scope
    if (!this.matchesScope(policy.scope, context)) {
      return {
        policyId,
        matched: false,
        matchedConditions: [],
        matchScore: 0,
        suggestedActions: [],
        evaluationTime: Date.now(),
      };
    }

    // Evaluate conditions
    const matchedConditions: PolicyCondition[] = [];
    const conditionScores: number[] = [];

    for (const condition of policy.conditions) {
      const score = this.evaluateCondition(condition, context);
      if (score > 0.5) {
        matchedConditions.push(condition);
      }
      conditionScores.push(score);
    }

    // Determine if policy matches based on strategy
    let matched = false;
    let matchScore = 0;

    switch (policy.evaluationStrategy) {
      case 'first-match':
        matched = matchedConditions.length > 0;
        matchScore = matchedConditions.length > 0 ? conditionScores[0] : 0;
        break;

      case 'all-match':
        matched = matchedConditions.length === policy.conditions.length;
        matchScore =
          conditionScores.reduce((a, b) => a + b, 0) / conditionScores.length;
        break;

      case 'best-match':
        matched = matchedConditions.length > policy.conditions.length * 0.5;
        matchScore = Math.max(...conditionScores, 0);
        break;
    }

    // Check cooldown
    if (matched && this.isInCooldown(policyId)) {
      matched = false;
    }

    // Check execution limit
    if (matched && this.exceedsExecutionLimit(policyId)) {
      matched = false;
    }

    const suggestedActions = matched ? policy.actions : [];

    const result: PolicyEvaluationResult = {
      policyId,
      matched,
      matchedConditions,
      matchScore,
      suggestedActions,
      evaluationTime: Date.now(),
    };

    // Record evaluation
    this.evaluationHistory.push({
      timestamp: Date.now(),
      policyId,
      context,
      result,
    });

    // Keep only recent evaluations
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    this.evaluationHistory = this.evaluationHistory.filter((e) => e.timestamp > cutoff);

    if (matched) {
      this.recordExecution(policyId);
      this.logger.info(
        { policyId, serviceName: context.serviceName, matchScore },
        'Policy matched'
      );
    }

    return result;
  }

  /**
   * Check if matches scope
   */
  private matchesScope(
    scope: Policy['scope'],
    context: EvaluationContext
  ): boolean {
    if (scope.serviceName) {
      const services = Array.isArray(scope.serviceName)
        ? scope.serviceName
        : [scope.serviceName];
      if (!services.includes(context.serviceName)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Evaluate condition
   */
  private evaluateCondition(
    condition: PolicyCondition,
    context: EvaluationContext
  ): number {
    switch (condition.type) {
      case 'metric':
        return this.evaluateMetricCondition(condition, context);

      case 'symptom':
        return this.evaluateSymptomCondition(condition, context);

      case 'event':
        return this.evaluateEventCondition(condition, context);

      case 'composite':
        return this.evaluateCompositeCondition(condition, context);

      default:
        return 0;
    }
  }

  /**
   * Evaluate metric condition
   */
  private evaluateMetricCondition(
    condition: PolicyCondition,
    context: EvaluationContext
  ): number {
    const metricValue = context.metrics[condition.name];

    if (metricValue === undefined) {
      return 0;
    }

    const threshold = condition.threshold || 0;

    switch (condition.operator) {
      case '>':
        return metricValue > threshold ? Math.min(1, metricValue / threshold) : 0;

      case '<':
        return metricValue < threshold ? Math.min(1, threshold / metricValue) : 0;

      case '=':
        return metricValue === threshold ? 1 : 0;

      case '!=':
        return metricValue !== threshold ? 1 : 0;

      default:
        return 0;
    }
  }

  /**
   * Evaluate symptom condition
   */
  private evaluateSymptomCondition(
    condition: PolicyCondition,
    context: EvaluationContext
  ): number {
    const symptoms = context.symptoms;

    switch (condition.operator) {
      case 'contains':
        return symptoms.some((s) => s.includes(condition.value)) ? 0.9 : 0;

      case 'matches':
        return symptoms.some((s) => this.matchesPattern(s, condition.value))
          ? 0.9
          : 0;

      case 'in':
        return symptoms.some((s) => condition.value.includes(s)) ? 0.9 : 0;

      default:
        return 0;
    }
  }

  /**
   * Evaluate event condition
   */
  private evaluateEventCondition(
    condition: PolicyCondition,
    context: EvaluationContext
  ): number {
    return context.events.some(
      (e) =>
        e.type === condition.name &&
        this.matchesPattern(JSON.stringify(e.data), condition.value)
    )
      ? 0.9
      : 0;
  }

  /**
   * Evaluate composite condition
   */
  private evaluateCompositeCondition(
    condition: PolicyCondition,
    context: EvaluationContext
  ): number {
    if (!condition.children || condition.children.length === 0) {
      return 0;
    }

    const childScores = condition.children.map((child) =>
      this.evaluateCondition(child, context)
    );

    switch (condition.operator) {
      case 'and':
        return childScores.every((s) => s > 0.5)
          ? childScores.reduce((a, b) => a + b, 0) / childScores.length
          : 0;

      case 'or':
        return childScores.some((s) => s > 0.5)
          ? Math.max(...childScores)
          : 0;

      case 'not':
        return childScores[0] < 0.5 ? 1 : 0;

      default:
        return 0;
    }
  }

  /**
   * Pattern matching helper
   */
  private matchesPattern(text: string, pattern: string): boolean {
    try {
      const regex = new RegExp(pattern, 'i');
      return regex.test(text);
    } catch {
      return text.toLowerCase().includes(pattern.toLowerCase());
    }
  }

  /**
   * Check if in cooldown
   */
  private isInCooldown(policyId: string): boolean {
    const lastTrigger = this.lastTriggerTime.get(policyId);
    if (!lastTrigger) return false;

    const policy = this.policies.get(policyId);
    if (!policy) return false;

    return Date.now() - lastTrigger < policy.cooldownMs;
  }

  /**
   * Check if exceeds execution limit
   */
  private exceedsExecutionLimit(policyId: string): boolean {
    const policy = this.policies.get(policyId);
    if (!policy) return false;

    const counts = this.executionCounts.get(policyId) || [];
    const recentCounts = counts.filter(
      (t) => t > Date.now() - policy.timeWindowMs
    );

    return recentCounts.length >= policy.maxExecutionsPerWindow;
  }

  /**
   * Record execution
   */
  private recordExecution(policyId: string): void {
    const counts = this.executionCounts.get(policyId) || [];
    counts.push(Date.now());

    // Clean up old entries
    const policy = this.policies.get(policyId);
    if (policy) {
      const cutoff = Date.now() - policy.timeWindowMs;
      this.executionCounts.set(
        policyId,
        counts.filter((t) => t > cutoff)
      );
    }

    this.lastTriggerTime.set(policyId, Date.now());
  }

  /**
   * Get policy
   */
  getPolicy(policyId: string): Policy | undefined {
    return this.policies.get(policyId);
  }

  /**
   * Get all policies
   */
  getAllPolicies(enabled?: boolean): Policy[] {
    return Array.from(this.policies.values()).filter(
      (p) => enabled === undefined || p.enabled === enabled
    );
  }

  /**
   * Get policy versions
   */
  getPolicyVersions(policyId: string): Policy[] {
    return this.policyVersions.get(policyId) || [];
  }

  /**
   * Get evaluation history
   */
  getEvaluationHistory(limit: number = 100): Array<{
    timestamp: number;
    policyId: string;
    matched: boolean;
  }> {
    return this.evaluationHistory
      .map((e) => ({
        timestamp: e.timestamp,
        policyId: e.policyId,
        matched: e.result.matched,
      }))
      .slice(-limit);
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalPolicies: number;
    enabledPolicies: number;
    totalEvaluations: number;
    matchedEvaluations: number;
    policyExecutionCounts: Record<string, number>;
  } {
    const allPolicies = Array.from(this.policies.values());
    const enabledCount = allPolicies.filter((p) => p.enabled).length;

    const matchedCount = this.evaluationHistory.filter(
      (e) => e.result.matched
    ).length;

    const executionCounts: Record<string, number> = {};
    for (const [policyId, counts] of this.executionCounts) {
      executionCounts[policyId] = counts.length;
    }

    return {
      totalPolicies: allPolicies.length,
      enabledPolicies: enabledCount,
      totalEvaluations: this.evaluationHistory.length,
      matchedEvaluations: matchedCount,
      policyExecutionCounts: executionCounts,
    };
  }
}

export default PolicyEngine;
