/**
 * OrbitalMind Rule Management API
 *
 * REST API for dynamic management of alert escalation, aggregation,
 * and incident creation rules with versioning and deployment support
 */

import pino from 'pino';

/**
 * Rule type
 */
export type RuleType = 'escalation' | 'aggregation' | 'incident-creation';

/**
 * Rule version
 */
export interface RuleVersion {
  version: number;
  timestamp: number;
  author: string;
  changes: string;
  enabled: boolean;
  ruleData: any;
}

/**
 * Managed rule
 */
export interface ManagedRule {
  id: string;
  name: string;
  type: RuleType;
  description: string;
  createdAt: number;
  createdBy: string;
  updatedAt: number;
  updatedBy: string;
  currentVersion: number;
  enabled: boolean;
  versions: RuleVersion[];
  tags: string[];
  deploymentStatus: 'draft' | 'staged' | 'deployed' | 'rolled-back';
  deploymentHistory: Array<{
    timestamp: number;
    action: 'deploy' | 'rollback';
    actor: string;
    targetVersion: number;
    details?: string;
  }>;
  testResults?: {
    passed: number;
    failed: number;
    lastTestTime: number;
    testDetails: Array<{
      name: string;
      passed: boolean;
      message: string;
    }>;
  };
}

/**
 * Rule template for quick creation
 */
export interface RuleTemplate {
  id: string;
  name: string;
  type: RuleType;
  description: string;
  template: any;
  parameters: Array<{
    name: string;
    type: 'string' | 'number' | 'boolean' | 'array';
    required: boolean;
    description: string;
  }>;
}

/**
 * Rule Management API
 */
export class RuleManagementAPI {
  private logger = pino();
  private rules: Map<string, ManagedRule> = new Map();
  private templates: Map<string, RuleTemplate> = new Map();
  private ruleCounter = 1000;
  private defaultTemplates: RuleTemplate[] = [];

  constructor() {
    this.setupDefaultTemplates();
  }

  /**
   * Set up default rule templates
   */
  private setupDefaultTemplates(): void {
    // Escalation rule template
    this.addTemplate({
      id: 'template-escalation-default',
      name: 'Default Escalation Pattern',
      type: 'escalation',
      description: 'Standard multi-level escalation with configurable delays',
      template: {
        enabled: true,
        levels: [
          {
            level: 'level-1',
            delayMinutes: 0,
            notificationChannels: ['slack'],
          },
          {
            level: 'level-2',
            delayMinutes: 5,
            notificationChannels: ['slack', 'email', 'pagerduty'],
          },
          {
            level: 'level-3',
            delayMinutes: 15,
            notificationChannels: ['slack', 'email', 'pagerduty'],
          },
          {
            level: 'level-4',
            delayMinutes: 30,
            notificationChannels: ['slack', 'email', 'sms'],
          },
        ],
      },
      parameters: [
        {
          name: 'severity',
          type: 'string',
          required: true,
          description: 'Alert severity level',
        },
        {
          name: 'serviceName',
          type: 'string',
          required: false,
          description: 'Target service (or * for all)',
        },
      ],
    });

    // Aggregation rule template
    this.addTemplate({
      id: 'template-aggregation-service',
      name: 'Service-Based Alert Aggregation',
      type: 'aggregation',
      description: 'Group related alerts by service and metric',
      template: {
        enabled: true,
        groupingStrategy: 'service-metric',
        deduplicationWindow: 300000,
        rules: [
          {
            pattern: { serviceName: 'thermal-engine' },
            groupBy: ['serviceName', 'metricName'],
            suppressionWindow: 600000,
          },
        ],
      },
      parameters: [
        {
          name: 'serviceName',
          type: 'string',
          required: true,
          description: 'Service to aggregate alerts for',
        },
        {
          name: 'deduplicationWindow',
          type: 'number',
          required: false,
          description: 'Window in milliseconds for deduplication',
        },
      ],
    });

    // Incident creation rule template
    this.addTemplate({
      id: 'template-incident-critical',
      name: 'Critical Alert to Incident',
      type: 'incident-creation',
      description: 'Automatically create Sev2 incidents for critical alerts',
      template: {
        enabled: true,
        trigger: 'alert-threshold',
        conditions: { severity: 'critical' },
        incidentConfig: {
          severity: 'sev2',
          tags: ['critical-alert', 'auto-created'],
          externalSystems: ['jira'],
        },
      },
      parameters: [
        {
          name: 'severity',
          type: 'string',
          required: true,
          description: 'Alert severity to match',
        },
        {
          name: 'incidentSeverity',
          type: 'string',
          required: true,
          description: 'Resulting incident severity',
        },
      ],
    });

    this.logger.info('Default rule templates configured');
  }

  /**
   * Add rule template
   */
  addTemplate(template: RuleTemplate): void {
    this.templates.set(template.id, template);

    this.logger.info(
      {
        templateId: template.id,
        type: template.type,
      },
      'Rule template added'
    );
  }

  /**
   * Get rule template
   */
  getTemplate(templateId: string): RuleTemplate | undefined {
    return this.templates.get(templateId);
  }

  /**
   * List all templates
   */
  listTemplates(type?: RuleType): RuleTemplate[] {
    const templates = Array.from(this.templates.values());
    return type ? templates.filter((t) => t.type === type) : templates;
  }

  /**
   * Create rule from template
   */
  createRuleFromTemplate(
    templateId: string,
    name: string,
    parameters: Record<string, any>,
    author: string
  ): ManagedRule | null {
    const template = this.templates.get(templateId);
    if (!template) {
      return null;
    }

    // Validate parameters
    for (const param of template.parameters) {
      if (param.required && !(param.name in parameters)) {
        this.logger.error(
          { param: param.name, templateId },
          'Required template parameter missing'
        );
        return null;
      }
    }

    // Apply parameters to template
    const ruleData = this.applyTemplateParameters(template.template, parameters);

    return this.createRule(
      name,
      template.type,
      `Created from template: ${template.name}`,
      ruleData,
      author,
      [`template:${templateId}`]
    );
  }

  /**
   * Apply template parameters to rule data
   */
  private applyTemplateParameters(
    template: any,
    parameters: Record<string, any>
  ): any {
    const result = JSON.parse(JSON.stringify(template));

    // Simple parameter substitution
    const replaceInObject = (obj: any) => {
      for (const key in obj) {
        if (typeof obj[key] === 'string' && obj[key].startsWith('${')) {
          const paramName = obj[key].slice(2, -1);
          if (paramName in parameters) {
            obj[key] = parameters[paramName];
          }
        } else if (typeof obj[key] === 'object') {
          replaceInObject(obj[key]);
        }
      }
    };

    replaceInObject(result);
    return result;
  }

  /**
   * Create rule
   */
  createRule(
    name: string,
    type: RuleType,
    description: string,
    ruleData: any,
    author: string,
    tags: string[] = []
  ): ManagedRule {
    const ruleId = `RULE-${this.ruleCounter++}`;
    const now = Date.now();

    const rule: ManagedRule = {
      id: ruleId,
      name,
      type,
      description,
      createdAt: now,
      createdBy: author,
      updatedAt: now,
      updatedBy: author,
      currentVersion: 1,
      enabled: true,
      versions: [
        {
          version: 1,
          timestamp: now,
          author,
          changes: 'Initial creation',
          enabled: true,
          ruleData,
        },
      ],
      tags,
      deploymentStatus: 'draft',
      deploymentHistory: [],
    };

    this.rules.set(ruleId, rule);

    this.logger.info(
      {
        ruleId,
        name,
        type,
        author,
      },
      'Rule created'
    );

    return rule;
  }

  /**
   * Update rule (creates new version)
   */
  updateRule(
    ruleId: string,
    ruleData: any,
    changes: string,
    author: string
  ): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      return false;
    }

    const newVersion = rule.currentVersion + 1;
    const now = Date.now();

    rule.versions.push({
      version: newVersion,
      timestamp: now,
      author,
      changes,
      enabled: rule.enabled,
      ruleData,
    });

    rule.currentVersion = newVersion;
    rule.updatedAt = now;
    rule.updatedBy = author;

    this.logger.info(
      {
        ruleId,
        newVersion,
        author,
      },
      'Rule updated'
    );

    return true;
  }

  /**
   * Deploy rule version
   */
  deployRule(ruleId: string, versionNumber?: number, actor?: string): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      return false;
    }

    const deployVersion = versionNumber || rule.currentVersion;
    const version = rule.versions.find((v) => v.version === deployVersion);

    if (!version) {
      return false;
    }

    const now = Date.now();

    rule.deploymentStatus = 'deployed';
    rule.deploymentHistory.push({
      timestamp: now,
      action: 'deploy',
      actor: actor || 'system',
      targetVersion: deployVersion,
      details: `Deployed version ${deployVersion}`,
    });

    this.logger.warn(
      {
        ruleId,
        version: deployVersion,
        actor,
      },
      'Rule deployed to production'
    );

    return true;
  }

  /**
   * Rollback rule to previous version
   */
  rollbackRule(ruleId: string, targetVersion: number, actor?: string): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      return false;
    }

    const targetVersionObj = rule.versions.find((v) => v.version === targetVersion);
    if (!targetVersionObj) {
      return false;
    }

    const now = Date.now();

    rule.deploymentStatus = 'rolled-back';
    rule.currentVersion = targetVersion;
    rule.deploymentHistory.push({
      timestamp: now,
      action: 'rollback',
      actor: actor || 'system',
      targetVersion,
      details: `Rolled back to version ${targetVersion}`,
    });

    this.logger.warn(
      {
        ruleId,
        targetVersion,
        actor,
      },
      'Rule rolled back to previous version'
    );

    return true;
  }

  /**
   * Test rule with sample data
   */
  testRule(
    ruleId: string,
    testData: Array<{
      name: string;
      input: any;
      expectedOutput: any;
    }>
  ): { passed: number; failed: number; details: Array<any> } {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      return { passed: 0, failed: 0, details: [] };
    }

    let passed = 0;
    let failed = 0;
    const details = [];

    for (const test of testData) {
      try {
        // Simulate rule evaluation
        const result = this.evaluateRule(rule.versions[rule.currentVersion - 1].ruleData, test.input);
        const testPassed = JSON.stringify(result) === JSON.stringify(test.expectedOutput);

        if (testPassed) {
          passed++;
          details.push({
            name: test.name,
            passed: true,
            message: 'Test passed',
          });
        } else {
          failed++;
          details.push({
            name: test.name,
            passed: false,
            message: `Expected ${JSON.stringify(test.expectedOutput)}, got ${JSON.stringify(result)}`,
          });
        }
      } catch (error) {
        failed++;
        details.push({
          name: test.name,
          passed: false,
          message: `Test error: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }

    // Store test results
    if (rule && testData.length > 0) {
      rule.testResults = {
        passed,
        failed,
        lastTestTime: Date.now(),
        testDetails: details,
      };
    }

    return { passed, failed, details };
  }

  /**
   * Simple rule evaluation (placeholder)
   */
  private evaluateRule(ruleData: any, input: any): any {
    // This is a simplified evaluation - real implementation would
    // evaluate the rule logic based on rule configuration
    if (ruleData.conditions) {
      for (const key in ruleData.conditions) {
        if (input[key] !== ruleData.conditions[key]) {
          return { matched: false };
        }
      }
      return { matched: true, action: ruleData.action };
    }
    return { matched: false };
  }

  /**
   * Enable rule
   */
  enableRule(ruleId: string): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      return false;
    }

    rule.enabled = true;
    return true;
  }

  /**
   * Disable rule
   */
  disableRule(ruleId: string): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      return false;
    }

    rule.enabled = false;
    return true;
  }

  /**
   * Get rule
   */
  getRule(ruleId: string): ManagedRule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * List all rules
   */
  listRules(type?: RuleType, tag?: string): ManagedRule[] {
    let rules = Array.from(this.rules.values());

    if (type) {
      rules = rules.filter((r) => r.type === type);
    }

    if (tag) {
      rules = rules.filter((r) => r.tags.includes(tag));
    }

    return rules;
  }

  /**
   * Get rule version
   */
  getRuleVersion(ruleId: string, versionNumber: number): RuleVersion | undefined {
    const rule = this.rules.get(ruleId);
    return rule?.versions.find((v) => v.version === versionNumber);
  }

  /**
   * Compare rule versions
   */
  compareVersions(
    ruleId: string,
    version1: number,
    version2: number
  ): { version1: RuleVersion; version2: RuleVersion; differences: string[] } | null {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      return null;
    }

    const v1 = rule.versions.find((v) => v.version === version1);
    const v2 = rule.versions.find((v) => v.version === version2);

    if (!v1 || !v2) {
      return null;
    }

    // Simple JSON-based comparison
    const data1 = JSON.stringify(v1.ruleData);
    const data2 = JSON.stringify(v2.ruleData);

    const differences = [];
    if (data1 !== data2) {
      differences.push('Rule data changed');
    }

    return { version1: v1, version2: v2, differences };
  }

  /**
   * Export rule as JSON
   */
  exportRule(ruleId: string): string | null {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      return null;
    }

    return JSON.stringify(
      {
        rule,
        exportedAt: Date.now(),
      },
      null,
      2
    );
  }

  /**
   * Import rule from JSON
   */
  importRule(ruleJson: string, author: string): ManagedRule | null {
    try {
      const data = JSON.parse(ruleJson);
      const rule = data.rule as ManagedRule;

      // Update author and timestamps
      rule.createdBy = author;
      rule.updatedBy = author;
      rule.createdAt = Date.now();
      rule.updatedAt = Date.now();
      rule.deploymentStatus = 'draft';
      rule.deploymentHistory = [];

      this.rules.set(rule.id, rule);

      this.logger.info(
        {
          ruleId: rule.id,
          author,
        },
        'Rule imported'
      );

      return rule;
    } catch (error) {
      this.logger.error({ error }, 'Failed to import rule');
      return null;
    }
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalRules: number;
    byType: Record<RuleType, number>;
    enabled: number;
    disabled: number;
    byDeploymentStatus: Record<string, number>;
  } {
    const rules = Array.from(this.rules.values());

    const byType: Record<RuleType, number> = {
      escalation: 0,
      aggregation: 0,
      'incident-creation': 0,
    };

    const byDeploymentStatus: Record<string, number> = {
      draft: 0,
      staged: 0,
      deployed: 0,
      'rolled-back': 0,
    };

    let enabled = 0;
    let disabled = 0;

    for (const rule of rules) {
      byType[rule.type]++;
      byDeploymentStatus[rule.deploymentStatus]++;

      if (rule.enabled) {
        enabled++;
      } else {
        disabled++;
      }
    }

    return {
      totalRules: rules.length,
      byType,
      enabled,
      disabled,
      byDeploymentStatus,
    };
  }
}

export default RuleManagementAPI;
