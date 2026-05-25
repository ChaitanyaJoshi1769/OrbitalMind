/**
 * OrbitalMind Alert Aggregation and Deduplication System
 *
 * Prevents alert fatigue by aggregating related alerts and deduplicating repeated issues
 */

import pino from 'pino';

/**
 * Alert signature for deduplication
 */
export interface AlertSignature {
  serviceName: string;
  metricName: string;
  severity: string;
  message: string;
}

/**
 * Aggregated alert group
 */
export interface AggregatedAlert {
  groupId: string;
  serviceName: string;
  metricName: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  firstOccurrence: number;
  lastOccurrence: number;
  occurrenceCount: number;
  affectedInstances: Set<string>;
  suppressed: boolean;
  suppressionReason?: string;
}

/**
 * Aggregation rule
 */
export interface AggregationRule {
  name: string;
  servicePattern: RegExp; // e.g., /^space-/
  metricPattern: RegExp; // e.g., /latency/
  severityThreshold: 'critical' | 'warning' | 'info';
  groupWindowSeconds: number;
  deduplicationWindowSeconds: number;
  suppressIfOccurrencesBelow: number; // Suppress transient alerts
}

/**
 * Alert aggregation statistics
 */
export interface AggregationStats {
  totalAlertsProcessed: number;
  uniqueGroupsCreated: number;
  duplicatesFiltered: number;
  suppressed: number;
  aggregatedGroups: number;
  lastAggregationTime: number;
}

/**
 * Alert Aggregator
 */
export class AlertAggregator {
  private logger = pino();
  private alertGroups: Map<string, AggregatedAlert> = new Map();
  private deduplicationCache: Map<string, number> = new Map();
  private rules: AggregationRule[] = [];
  private stats: AggregationStats = {
    totalAlertsProcessed: 0,
    uniqueGroupsCreated: 0,
    duplicatesFiltered: 0,
    suppressed: 0,
    aggregatedGroups: 0,
    lastAggregationTime: 0,
  };

  constructor() {
    this.setupDefaultRules();
  }

  /**
   * Set up default aggregation rules
   */
  private setupDefaultRules(): void {
    // Space service alerts
    this.addRule({
      name: 'space-services',
      servicePattern: /^(space-|orbital-)/,
      metricPattern: /.*/,
      severityThreshold: 'warning',
      groupWindowSeconds: 60,
      deduplicationWindowSeconds: 30,
      suppressIfOccurrencesBelow: 1,
    });

    // Thermal and power alerts
    this.addRule({
      name: 'thermal-power',
      servicePattern: /^(thermal-|power-)/,
      metricPattern: /(temperature|power|thermal|battery)/,
      severityThreshold: 'warning',
      groupWindowSeconds: 120,
      deduplicationWindowSeconds: 60,
      suppressIfOccurrencesBelow: 2,
    });

    // Communication alerts
    this.addRule({
      name: 'communication',
      servicePattern: /^(communication-|blockchain)/,
      metricPattern: /(latency|transmission|query)/,
      severityThreshold: 'info',
      groupWindowSeconds: 60,
      deduplicationWindowSeconds: 30,
      suppressIfOccurrencesBelow: 1,
    });

    // Data processing alerts
    this.addRule({
      name: 'data-services',
      servicePattern: /^(science-|sensor-|digital-)/,
      metricPattern: /(processing|analysis|fusion)/,
      severityThreshold: 'warning',
      groupWindowSeconds: 120,
      deduplicationWindowSeconds: 60,
      suppressIfOccurrencesBelow: 2,
    });
  }

  /**
   * Add custom aggregation rule
   */
  addRule(rule: AggregationRule): void {
    this.rules.push(rule);
    this.logger.info(
      {
        name: rule.name,
        servicePattern: rule.servicePattern.source,
        metricPattern: rule.metricPattern.source,
      },
      'Aggregation rule added'
    );
  }

  /**
   * Process an alert for aggregation
   */
  processAlert(alert: {
    serviceName: string;
    metricName: string;
    severity: 'critical' | 'warning' | 'info';
    message: string;
    instanceId?: string;
  }): { aggregated: boolean; groupId: string; isDuplicate: boolean } {
    this.stats.totalAlertsProcessed++;

    // Check for duplicate
    const signature = this.generateSignature(alert);
    const signatureKey = JSON.stringify(signature);
    const lastSeenTime = this.deduplicationCache.get(signatureKey);
    const isDuplicate = lastSeenTime && (Date.now() - lastSeenTime) < 30000; // 30 second dedup window

    if (isDuplicate) {
      this.stats.duplicatesFiltered++;
      return {
        aggregated: true,
        groupId: this.generateGroupId(alert),
        isDuplicate: true,
      };
    }

    // Update deduplication cache
    this.deduplicationCache.set(signatureKey, Date.now());

    // Find applicable rule and aggregate
    const applicableRule = this.findApplicableRule(alert);
    const groupId = this.generateGroupId(alert);

    if (this.alertGroups.has(groupId)) {
      // Add to existing group
      const group = this.alertGroups.get(groupId)!;
      group.occurrenceCount++;
      group.lastOccurrence = Date.now();

      if (alert.instanceId) {
        group.affectedInstances.add(alert.instanceId);
      }

      // Check suppression criteria
      if (applicableRule && group.occurrenceCount < applicableRule.suppressIfOccurrencesBelow) {
        group.suppressed = true;
        group.suppressionReason = 'Below occurrence threshold for this alert type';
        this.stats.suppressed++;
      } else {
        group.suppressed = false;
      }
    } else {
      // Create new group
      const newGroup: AggregatedAlert = {
        groupId,
        serviceName: alert.serviceName,
        metricName: alert.metricName,
        severity: alert.severity,
        message: alert.message,
        firstOccurrence: Date.now(),
        lastOccurrence: Date.now(),
        occurrenceCount: 1,
        affectedInstances: alert.instanceId ? new Set([alert.instanceId]) : new Set(),
        suppressed: applicableRule ? 1 < applicableRule.suppressIfOccurrencesBelow : false,
        suppressionReason: applicableRule && 1 < applicableRule.suppressIfOccurrencesBelow
          ? 'Below occurrence threshold for this alert type'
          : undefined,
      };

      this.alertGroups.set(groupId, newGroup);
      this.stats.uniqueGroupsCreated++;

      if (newGroup.suppressed) {
        this.stats.suppressed++;
      }
    }

    this.stats.lastAggregationTime = Date.now();
    this.stats.aggregatedGroups = this.alertGroups.size;

    return {
      aggregated: true,
      groupId,
      isDuplicate: false,
    };
  }

  /**
   * Find applicable aggregation rule for alert
   */
  private findApplicableRule(alert: {
    serviceName: string;
    metricName: string;
    severity: 'critical' | 'warning' | 'info';
  }): AggregationRule | null {
    for (const rule of this.rules) {
      if (
        rule.servicePattern.test(alert.serviceName) &&
        rule.metricPattern.test(alert.metricName)
      ) {
        return rule;
      }
    }

    return null;
  }

  /**
   * Generate alert signature for deduplication
   */
  private generateSignature(alert: {
    serviceName: string;
    metricName: string;
    severity: string;
    message: string;
  }): AlertSignature {
    return {
      serviceName: alert.serviceName,
      metricName: alert.metricName,
      severity: alert.severity,
      message: alert.message,
    };
  }

  /**
   * Generate group ID for alert
   */
  private generateGroupId(alert: { serviceName: string; metricName: string }): string {
    return `${alert.serviceName}:${alert.metricName}`;
  }

  /**
   * Get aggregated alert group
   */
  getAlertGroup(groupId: string): AggregatedAlert | undefined {
    return this.alertGroups.get(groupId);
  }

  /**
   * Get all active aggregated groups
   */
  getAllAlertGroups(includeSupressed: boolean = false): AggregatedAlert[] {
    const groups = Array.from(this.alertGroups.values());

    if (!includeSupressed) {
      return groups.filter(g => !g.suppressed);
    }

    return groups;
  }

  /**
   * Get alert groups by severity
   */
  getAlertGroupsBySeverity(severity: 'critical' | 'warning' | 'info'): AggregatedAlert[] {
    return this.getAllAlertGroups().filter(g => g.severity === severity);
  }

  /**
   * Get alert groups by service
   */
  getAlertGroupsByService(serviceName: string): AggregatedAlert[] {
    return this.getAllAlertGroups().filter(g => g.serviceName === serviceName);
  }

  /**
   * Acknowledge an alert group (suppress until next occurrence)
   */
  acknowledgeAlertGroup(groupId: string): boolean {
    const group = this.alertGroups.get(groupId);
    if (group) {
      group.suppressed = true;
      group.suppressionReason = 'Acknowledged by operator';
      this.logger.info({ groupId }, 'Alert group acknowledged');
      return true;
    }

    return false;
  }

  /**
   * Resolve an alert group (remove from active list)
   */
  resolveAlertGroup(groupId: string): boolean {
    const deleted = this.alertGroups.delete(groupId);

    if (deleted) {
      this.logger.info({ groupId }, 'Alert group resolved');
    }

    return deleted;
  }

  /**
   * Clear expired groups
   */
  clearExpiredGroups(maxAgeSeconds: number = 3600): number {
    const cutoffTime = Date.now() - (maxAgeSeconds * 1000);
    let cleared = 0;

    for (const [groupId, group] of this.alertGroups.entries()) {
      if (group.lastOccurrence < cutoffTime && group.suppressed) {
        this.alertGroups.delete(groupId);
        cleared++;
      }
    }

    this.stats.aggregatedGroups = this.alertGroups.size;

    return cleared;
  }

  /**
   * Clear deduplication cache
   */
  clearDeduplicationCache(maxAgeSeconds: number = 300): number {
    const cutoffTime = Date.now() - (maxAgeSeconds * 1000);
    let cleared = 0;

    for (const [key, timestamp] of this.deduplicationCache.entries()) {
      if (timestamp < cutoffTime) {
        this.deduplicationCache.delete(key);
        cleared++;
      }
    }

    return cleared;
  }

  /**
   * Get aggregation statistics
   */
  getStats(): AggregationStats {
    return { ...this.stats };
  }

  /**
   * Export aggregation report as JSON
   */
  exportReport(): string {
    const groups = this.getAllAlertGroups(true);
    const stats = this.getStats();

    return JSON.stringify({
      stats,
      alertGroups: groups.map(g => ({
        ...g,
        affectedInstances: Array.from(g.affectedInstances),
      })),
    }, null, 2);
  }

  /**
   * Print formatted aggregation report
   */
  printReport(): void {
    const activeGroups = this.getAllAlertGroups();
    const stats = this.getStats();

    const critical = activeGroups.filter(g => g.severity === 'critical');
    const warnings = activeGroups.filter(g => g.severity === 'warning');
    const info = activeGroups.filter(g => g.severity === 'info');

    console.log(`
╔════════════════════════════════════════════════════════════╗
║        Alert Aggregation and Deduplication Report         ║
╚════════════════════════════════════════════════════════════╝

📊 Statistics:
   Total Alerts Processed: ${stats.totalAlertsProcessed}
   Unique Groups Created: ${stats.uniqueGroupsCreated}
   Duplicates Filtered: ${stats.duplicatesFiltered}
   Suppressed: ${stats.suppressed}
   Active Groups: ${stats.aggregatedGroups}

🎯 Active Alert Groups:
   Critical: ${critical.length}
   Warnings: ${warnings.length}
   Info: ${info.length}

🚨 Critical Alerts:
${critical.length === 0 ? '   None' : critical.map(g =>
  `   [${g.groupId}] ${g.message}
      Occurrences: ${g.occurrenceCount}
      Affected Instances: ${g.affectedInstances.size}
      First Seen: ${new Date(g.firstOccurrence).toISOString()}
      Last Seen: ${new Date(g.lastOccurrence).toISOString()}`
).join('\n\n')}

⚠️  Warnings:
${warnings.length === 0 ? '   None' : warnings.slice(0, 5).map(g =>
  `   [${g.groupId}] ${g.message}
      Occurrences: ${g.occurrenceCount}`
).join('\n\n')}${warnings.length > 5 ? `\n\n   ... and ${warnings.length - 5} more` : ''}

ℹ️  Info:
${info.length === 0 ? '   None' : info.slice(0, 3).map(g =>
  `   [${g.groupId}] ${g.message}`
).join('\n\n')}${info.length > 3 ? `\n\n   ... and ${info.length - 3} more` : ''}

⏰ Generated: ${new Date().toISOString()}
    `);
  }
}

export default AlertAggregator;
