/**
 * OrbitalMind Alert Escalation System
 *
 * Automatically escalates critical alerts based on time-to-acknowledge
 * and implementation of escalation policies for on-call management
 */

import pino from 'pino';

/**
 * Escalation level
 */
export type EscalationLevel = 'level-1' | 'level-2' | 'level-3' | 'level-4' | 'resolved';

/**
 * Escalation policy
 */
export interface EscalationPolicy {
  name: string;
  serviceName: string; // or '*' for all services
  severity: 'critical' | 'warning' | 'info';
  escalationLevels: Array<{
    level: EscalationLevel;
    delayMinutes: number;
    recipients: string[]; // email addresses or escalation contacts
    notificationChannels: ('email' | 'slack' | 'pagerduty' | 'sms')[];
    action?: 'page' | 'notify' | 'create-incident';
  }>;
}

/**
 * Escalation state for an alert
 */
export interface AlertEscalationState {
  alertId: string;
  groupId: string;
  serviceName: string;
  severity: 'critical' | 'warning' | 'info';
  createdAt: number;
  firstEscalationAt?: number;
  currentLevel: EscalationLevel;
  nextEscalationAt?: number;
  acknowledged: boolean;
  acknowledgedAt?: number;
  acknowledgedBy?: string;
  escalationHistory: Array<{
    level: EscalationLevel;
    timestamp: number;
    notifiedRecipients: string[];
  }>;
  resolvedAt?: number;
}

/**
 * Alert Escalation Manager
 */
export class AlertEscalationManager {
  private logger = pino();
  private policies: Map<string, EscalationPolicy> = new Map();
  private escalationStates: Map<string, AlertEscalationState> = new Map();
  private escaltionCheckInterval: NodeJS.Timer | null = null;
  private recipients: Map<string, string> = new Map(); // name -> contact
  private escalationCallbacks: Array<(state: AlertEscalationState) => Promise<void>> = [];

  constructor() {
    this.setupDefaultPolicies();
  }

  /**
   * Set up default escalation policies
   */
  private setupDefaultPolicies(): void {
    // Critical alerts - aggressive escalation
    this.addPolicy({
      name: 'critical-default',
      serviceName: '*',
      severity: 'critical',
      escalationLevels: [
        {
          level: 'level-1',
          delayMinutes: 0,
          recipients: ['on-call-engineer@orbitalmind.io'],
          notificationChannels: ['slack', 'email'],
          action: 'page',
        },
        {
          level: 'level-2',
          delayMinutes: 5,
          recipients: ['on-call-lead@orbitalmind.io'],
          notificationChannels: ['slack', 'email', 'pagerduty'],
          action: 'page',
        },
        {
          level: 'level-3',
          delayMinutes: 15,
          recipients: ['ops-manager@orbitalmind.io'],
          notificationChannels: ['slack', 'email', 'pagerduty'],
          action: 'create-incident',
        },
        {
          level: 'level-4',
          delayMinutes: 30,
          recipients: ['vp-engineering@orbitalmind.io'],
          notificationChannels: ['slack', 'email', 'sms'],
          action: 'create-incident',
        },
      ],
    });

    // Warning alerts - moderate escalation
    this.addPolicy({
      name: 'warning-default',
      serviceName: '*',
      severity: 'warning',
      escalationLevels: [
        {
          level: 'level-1',
          delayMinutes: 0,
          recipients: ['ops-team@orbitalmind.io'],
          notificationChannels: ['slack'],
          action: 'notify',
        },
        {
          level: 'level-2',
          delayMinutes: 10,
          recipients: ['ops-lead@orbitalmind.io'],
          notificationChannels: ['slack', 'email'],
          action: 'notify',
        },
        {
          level: 'level-3',
          delayMinutes: 30,
          recipients: ['on-call-engineer@orbitalmind.io'],
          notificationChannels: ['email'],
          action: 'notify',
        },
      ],
    });

    // Info alerts - minimal escalation
    this.addPolicy({
      name: 'info-default',
      serviceName: '*',
      severity: 'info',
      escalationLevels: [
        {
          level: 'level-1',
          delayMinutes: 0,
          recipients: ['monitoring-log@orbitalmind.io'],
          notificationChannels: ['email'],
          action: 'notify',
        },
      ],
    });
  }

  /**
   * Add escalation policy
   */
  addPolicy(policy: EscalationPolicy): void {
    this.policies.set(policy.name, policy);

    this.logger.info(
      {
        name: policy.name,
        serviceName: policy.serviceName,
        severity: policy.severity,
        levels: policy.escalationLevels.length,
      },
      'Escalation policy added'
    );
  }

  /**
   * Register recipient for escalation
   */
  registerRecipient(name: string, contact: string): void {
    this.recipients.set(name, contact);
  }

  /**
   * Create escalation state for alert
   */
  trackAlert(alert: {
    alertId: string;
    groupId: string;
    serviceName: string;
    severity: 'critical' | 'warning' | 'info';
  }): AlertEscalationState {
    const state: AlertEscalationState = {
      alertId: alert.alertId,
      groupId: alert.groupId,
      serviceName: alert.serviceName,
      severity: alert.severity,
      createdAt: Date.now(),
      currentLevel: 'level-1',
      acknowledged: false,
      escalationHistory: [],
    };

    this.escalationStates.set(alert.alertId, state);

    this.logger.info(
      {
        alertId: alert.alertId,
        service: alert.serviceName,
        severity: alert.severity,
      },
      'Alert tracking started'
    );

    return state;
  }

  /**
   * Acknowledge an alert (stops escalation)
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    const state = this.escalationStates.get(alertId);

    if (!state) {
      return false;
    }

    state.acknowledged = true;
    state.acknowledgedAt = Date.now();
    state.acknowledgedBy = acknowledgedBy;

    this.logger.info(
      {
        alertId,
        acknowledgedBy,
        escalationLevel: state.currentLevel,
      },
      'Alert acknowledged - escalation stopped'
    );

    return true;
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const state = this.escalationStates.get(alertId);

    if (!state) {
      return false;
    }

    state.resolvedAt = Date.now();
    state.currentLevel = 'resolved';

    this.logger.info({ alertId }, 'Alert resolved');

    return true;
  }

  /**
   * Find applicable escalation policy
   */
  private findApplicablePolicy(state: AlertEscalationState): EscalationPolicy | null {
    // Try service-specific policy first
    for (const policy of this.policies.values()) {
      if (
        policy.severity === state.severity &&
        (policy.serviceName === state.serviceName || policy.serviceName === '*')
      ) {
        return policy;
      }
    }

    return null;
  }

  /**
   * Check escalation status (should be called periodically)
   */
  async checkEscalations(): Promise<AlertEscalationState[]> {
    const escalatedAlerts: AlertEscalationState[] = [];
    const now = Date.now();

    for (const state of this.escalationStates.values()) {
      // Skip resolved or acknowledged alerts
      if (state.resolvedAt || state.acknowledged) {
        continue;
      }

      const policy = this.findApplicablePolicy(state);
      if (!policy) {
        continue;
      }

      // Find current escalation level
      const currentLevelConfig = policy.escalationLevels.find(
        (l) => l.level === state.currentLevel
      );

      if (!currentLevelConfig) {
        continue;
      }

      // Check if escalation is due
      const nextEscalationDue = state.firstEscalationAt
        ? state.firstEscalationAt + currentLevelConfig.delayMinutes * 60 * 1000
        : state.createdAt + currentLevelConfig.delayMinutes * 60 * 1000;

      if (now >= nextEscalationDue) {
        // Escalate to next level
        const nextLevelIndex = policy.escalationLevels.findIndex(
          (l) => l.level === state.currentLevel
        ) + 1;

        if (nextLevelIndex < policy.escalationLevels.length) {
          const nextLevel = policy.escalationLevels[nextLevelIndex];

          // Update state
          state.currentLevel = nextLevel.level;
          state.nextEscalationAt = now + nextLevel.delayMinutes * 60 * 1000;

          // Record escalation history
          state.escalationHistory.push({
            level: nextLevel.level,
            timestamp: now,
            notifiedRecipients: nextLevel.recipients,
          });

          if (!state.firstEscalationAt) {
            state.firstEscalationAt = now;
          }

          escalatedAlerts.push(state);

          this.logger.warn(
            {
              alertId: state.alertId,
              from: policy.escalationLevels[nextLevelIndex - 1].level,
              to: nextLevel.level,
              recipients: nextLevel.recipients,
              action: nextLevel.action,
            },
            'Alert escalated'
          );

          // Execute escalation callbacks
          for (const callback of this.escalationCallbacks) {
            try {
              await callback(state);
            } catch (error) {
              this.logger.error(
                { error, alertId: state.alertId },
                'Escalation callback failed'
              );
            }
          }
        }
      }
    }

    return escalatedAlerts;
  }

  /**
   * Register escalation callback
   */
  onEscalation(callback: (state: AlertEscalationState) => Promise<void>): void {
    this.escalationCallbacks.push(callback);
  }

  /**
   * Start periodic escalation checking
   */
  startEscalationChecking(intervalSeconds: number = 60): void {
    if (this.escaltionCheckInterval) {
      this.logger.warn('Escalation checking already started');
      return;
    }

    this.escaltionCheckInterval = setInterval(
      async () => {
        try {
          await this.checkEscalations();
        } catch (error) {
          this.logger.error({ error }, 'Error checking escalations');
        }
      },
      intervalSeconds * 1000
    );

    this.logger.info({ intervalSeconds }, 'Escalation checking started');
  }

  /**
   * Stop periodic escalation checking
   */
  stopEscalationChecking(): void {
    if (this.escaltionCheckInterval) {
      clearInterval(this.escaltionCheckInterval);
      this.escaltionCheckInterval = null;
      this.logger.info('Escalation checking stopped');
    }
  }

  /**
   * Get escalation state
   */
  getEscalationState(alertId: string): AlertEscalationState | undefined {
    return this.escalationStates.get(alertId);
  }

  /**
   * Get all escalation states
   */
  getAllEscalationStates(): AlertEscalationState[] {
    return Array.from(this.escalationStates.values());
  }

  /**
   * Get escalation states by level
   */
  getEscalationStatesByLevel(level: EscalationLevel): AlertEscalationState[] {
    return Array.from(this.escalationStates.values()).filter(
      (s) => s.currentLevel === level
    );
  }

  /**
   * Get pending escalations
   */
  getPendingEscalations(): AlertEscalationState[] {
    return Array.from(this.escalationStates.values()).filter(
      (s) => !s.resolvedAt && !s.acknowledged
    );
  }

  /**
   * Get escalation statistics
   */
  getStatistics(): {
    totalTracked: number;
    unacknowledged: number;
    resolved: number;
    byLevel: Record<EscalationLevel, number>;
    avgTimeToAcknowledge: number;
    escalationRate: number;
  } {
    const states = Array.from(this.escalationStates.values());
    const unacknowledged = states.filter((s) => !s.acknowledged && !s.resolvedAt);
    const acknowledged = states.filter((s) => s.acknowledged && s.acknowledgedAt);
    const resolved = states.filter((s) => s.resolvedAt);

    const byLevel: Record<EscalationLevel, number> = {
      'level-1': 0,
      'level-2': 0,
      'level-3': 0,
      'level-4': 0,
      resolved: 0,
    };

    for (const state of states) {
      byLevel[state.currentLevel]++;
    }

    const avgTimeToAcknowledge =
      acknowledged.length > 0
        ? acknowledged.reduce((sum, s) => sum + (s.acknowledgedAt! - s.createdAt), 0) /
          acknowledged.length /
          1000 /
          60
        : 0;

    const escalationRate =
      states.length > 0
        ? states.filter((s) => s.escalationHistory.length > 0).length / states.length
        : 0;

    return {
      totalTracked: states.length,
      unacknowledged: unacknowledged.length,
      resolved: resolved.length,
      byLevel,
      avgTimeToAcknowledge,
      escalationRate,
    };
  }

  /**
   * Export escalation report
   */
  exportReport(): string {
    const stats = this.getStatistics();
    const states = this.getAllEscalationStates();

    return JSON.stringify(
      {
        timestamp: Date.now(),
        statistics: stats,
        escalationStates: states,
      },
      null,
      2
    );
  }

  /**
   * Print formatted escalation report
   */
  printReport(): void {
    const stats = this.getStatistics();
    const unacknowledged = this.getPendingEscalations();

    console.log(`
╔════════════════════════════════════════════════════════════╗
║         Alert Escalation Management Report                ║
╚════════════════════════════════════════════════════════════╝

📊 Statistics:
   Total Tracked: ${stats.totalTracked}
   Unacknowledged: ${stats.unacknowledged}
   Resolved: ${stats.resolved}
   Avg Time to Acknowledge: ${stats.avgTimeToAcknowledge.toFixed(1)} minutes
   Escalation Rate: ${(stats.escalationRate * 100).toFixed(1)}%

📍 By Level:
   Level 1: ${stats.byLevel['level-1']}
   Level 2: ${stats.byLevel['level-2']}
   Level 3: ${stats.byLevel['level-3']}
   Level 4: ${stats.byLevel['level-4']}

🚨 Pending Escalations: ${unacknowledged.length}
${
  unacknowledged.length > 0
    ? unacknowledged
        .map(
          (s) =>
            `   ${s.alertId} (${s.serviceName}): Level ${s.currentLevel} for ${Math.round((Date.now() - s.createdAt) / 1000 / 60)} min`
        )
        .join('\n')
    : '   None'
}

⏰ Generated: ${new Date().toISOString()}
    `);
  }
}

export default AlertEscalationManager;
