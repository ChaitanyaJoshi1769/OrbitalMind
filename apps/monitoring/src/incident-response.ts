/**
 * OrbitalMind Incident Response Automation
 *
 * Automatically creates and manages incidents based on alert severity,
 * SLA violations, and escalation events
 */

import pino from 'pino';

/**
 * Incident severity
 */
export type IncidentSeverity = 'sev1' | 'sev2' | 'sev3' | 'sev4';

/**
 * Incident status
 */
export type IncidentStatus = 'open' | 'investigating' | 'mitigating' | 'resolved' | 'closed';

/**
 * Incident ticket
 */
export interface IncidentTicket {
  id: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  serviceName: string;
  alertIds: string[];
  createdAt: number;
  createdBy: string;
  assignedTo?: string;
  slaViolation?: {
    serviceName: string;
    violationType: 'uptime' | 'latency' | 'errorRate';
    targetValue: number;
    actualValue: number;
  };
  timeline: Array<{
    timestamp: number;
    action: string;
    actor: string;
    details?: string;
  }>;
  externalTicketIds?: Record<string, string>; // Jira, ServiceNow, etc.
  tags: string[];
  metrics?: {
    detectionTime: number; // ms from alert to incident creation
    acknowledgeTime?: number;
    mitigationTime?: number;
    resolutionTime?: number;
  };
}

/**
 * Incident creation rule
 */
export interface IncidentCreationRule {
  name: string;
  enabled: boolean;
  trigger: 'alert-escalation' | 'sla-violation' | 'alert-threshold';
  conditions: {
    severity?: 'critical' | 'warning' | 'info';
    serviceName?: string; // or '*' for all
    escalationLevel?: 'level-3' | 'level-4';
    consecutiveAlerts?: number;
    withinMinutes?: number;
  };
  incidentConfig: {
    severity: IncidentSeverity;
    assignee?: string;
    tags: string[];
    externalSystems: ('jira' | 'servicenow' | 'opsgenie' | 'victorops')[];
  };
}

/**
 * Incident Response Manager
 */
export class IncidentResponseManager {
  private logger = pino();
  private incidents: Map<string, IncidentTicket> = new Map();
  private rules: Map<string, IncidentCreationRule> = new Map();
  private incidentCounter = 1000;
  private externalIntegrations: Map<string, any> = new Map();

  constructor() {
    this.setupDefaultRules();
  }

  /**
   * Set up default incident creation rules
   */
  private setupDefaultRules(): void {
    // Level 4 escalation -> Sev1 Incident
    this.addRule({
      name: 'level-4-escalation',
      enabled: true,
      trigger: 'alert-escalation',
      conditions: {
        escalationLevel: 'level-4',
      },
      incidentConfig: {
        severity: 'sev1',
        assignee: 'incident-commander@orbitalmind.io',
        tags: ['escalation', 'critical', 'requires-ceo-notification'],
        externalSystems: ['jira', 'servicenow', 'opsgenie'],
      },
    });

    // Level 3 escalation -> Sev2 Incident
    this.addRule({
      name: 'level-3-escalation',
      enabled: true,
      trigger: 'alert-escalation',
      conditions: {
        escalationLevel: 'level-3',
      },
      incidentConfig: {
        severity: 'sev2',
        assignee: 'ops-manager@orbitalmind.io',
        tags: ['escalation', 'management-notify'],
        externalSystems: ['jira', 'servicenow'],
      },
    });

    // Critical alert threshold
    this.addRule({
      name: 'critical-alert-incident',
      enabled: true,
      trigger: 'alert-threshold',
      conditions: {
        severity: 'critical',
      },
      incidentConfig: {
        severity: 'sev2',
        tags: ['critical-alert'],
        externalSystems: ['jira'],
      },
    });

    // SLA violations -> Sev2/3 Incident
    this.addRule({
      name: 'sla-violation-incident',
      enabled: true,
      trigger: 'sla-violation',
      conditions: {
        serviceName: '*',
      },
      incidentConfig: {
        severity: 'sev3',
        assignee: 'ops-lead@orbitalmind.io',
        tags: ['sla-violation', 'compliance-risk'],
        externalSystems: ['jira'],
      },
    });

    this.logger.info('Default incident creation rules configured');
  }

  /**
   * Add incident creation rule
   */
  addRule(rule: IncidentCreationRule): void {
    this.rules.set(rule.name, rule);

    this.logger.info(
      {
        name: rule.name,
        trigger: rule.trigger,
        enabled: rule.enabled,
      },
      'Incident creation rule added'
    );
  }

  /**
   * Register external incident system integration
   */
  registerExternalIntegration(
    system: 'jira' | 'servicenow' | 'opsgenie' | 'victorops',
    integration: any
  ): void {
    this.externalIntegrations.set(system, integration);

    this.logger.info({ system }, 'External incident system registered');
  }

  /**
   * Create incident from alert
   */
  async createIncidentFromAlert(
    alertId: string,
    alert: {
      serviceName: string;
      severity: 'critical' | 'warning' | 'info';
      message: string;
    },
    createdBy: string
  ): Promise<IncidentTicket | null> {
    // Find applicable rule
    let applicableRule: IncidentCreationRule | null = null;

    for (const rule of this.rules.values()) {
      if (!rule.enabled || rule.trigger !== 'alert-threshold') {
        continue;
      }

      if (
        rule.conditions.severity &&
        rule.conditions.severity !== alert.severity
      ) {
        continue;
      }

      if (
        rule.conditions.serviceName &&
        rule.conditions.serviceName !== '*' &&
        rule.conditions.serviceName !== alert.serviceName
      ) {
        continue;
      }

      applicableRule = rule;
      break;
    }

    if (!applicableRule) {
      return null;
    }

    return this.createIncident(
      `[${alert.severity.toUpperCase()}] ${alert.message}`,
      alert.message,
      applicableRule.incidentConfig.severity,
      alert.serviceName,
      [alertId],
      createdBy,
      applicableRule.incidentConfig.tags,
      applicableRule.incidentConfig.externalSystems
    );
  }

  /**
   * Create incident from SLA violation
   */
  async createIncidentFromSLAViolation(
    slaViolation: {
      serviceName: string;
      violationType: 'uptime' | 'latency' | 'errorRate';
      targetValue: number;
      actualValue: number;
    },
    createdBy: string
  ): Promise<IncidentTicket | null> {
    // Find applicable rule
    let applicableRule: IncidentCreationRule | null = null;

    for (const rule of this.rules.values()) {
      if (!rule.enabled || rule.trigger !== 'sla-violation') {
        continue;
      }

      if (
        rule.conditions.serviceName &&
        rule.conditions.serviceName !== '*' &&
        rule.conditions.serviceName !== slaViolation.serviceName
      ) {
        continue;
      }

      applicableRule = rule;
      break;
    }

    if (!applicableRule) {
      return null;
    }

    const description = `SLA Violation: ${slaViolation.serviceName}
Violation Type: ${slaViolation.violationType}
Target Value: ${slaViolation.targetValue}
Actual Value: ${slaViolation.actualValue}
Threshold Exceeded By: ${Math.round(((slaViolation.actualValue - slaViolation.targetValue) / slaViolation.targetValue) * 100)}%`;

    const ticket = await this.createIncident(
      `SLA Violation: ${slaViolation.serviceName} - ${slaViolation.violationType}`,
      description,
      applicableRule.incidentConfig.severity,
      slaViolation.serviceName,
      [],
      createdBy,
      applicableRule.incidentConfig.tags,
      applicableRule.incidentConfig.externalSystems
    );

    if (ticket) {
      ticket.slaViolation = slaViolation;
    }

    return ticket;
  }

  /**
   * Create incident from escalation
   */
  async createIncidentFromEscalation(
    alertId: string,
    escalationLevel: 'level-3' | 'level-4',
    alert: {
      serviceName: string;
      message: string;
    },
    createdBy: string
  ): Promise<IncidentTicket | null> {
    // Find applicable rule
    let applicableRule: IncidentCreationRule | null = null;

    for (const rule of this.rules.values()) {
      if (!rule.enabled || rule.trigger !== 'alert-escalation') {
        continue;
      }

      if (
        rule.conditions.escalationLevel &&
        rule.conditions.escalationLevel !== escalationLevel
      ) {
        continue;
      }

      applicableRule = rule;
      break;
    }

    if (!applicableRule) {
      return null;
    }

    return this.createIncident(
      `[ESCALATION: ${escalationLevel.toUpperCase()}] ${alert.message}`,
      `Alert escalated to ${escalationLevel}\n\nOriginal Message: ${alert.message}`,
      applicableRule.incidentConfig.severity,
      alert.serviceName,
      [alertId],
      createdBy,
      applicableRule.incidentConfig.tags,
      applicableRule.incidentConfig.externalSystems
    );
  }

  /**
   * Create incident
   */
  async createIncident(
    title: string,
    description: string,
    severity: IncidentSeverity,
    serviceName: string,
    alertIds: string[],
    createdBy: string,
    tags: string[],
    externalSystems: ('jira' | 'servicenow' | 'opsgenie' | 'victorops')[]
  ): Promise<IncidentTicket> {
    const incidentId = `INC-${this.incidentCounter++}`;

    const ticket: IncidentTicket = {
      id: incidentId,
      title,
      description,
      severity,
      status: 'open',
      serviceName,
      alertIds,
      createdAt: Date.now(),
      createdBy,
      tags,
      timeline: [
        {
          timestamp: Date.now(),
          action: 'created',
          actor: createdBy,
          details: `Incident created: ${title}`,
        },
      ],
      metrics: {
        detectionTime: 0,
      },
    };

    this.incidents.set(incidentId, ticket);

    this.logger.warn(
      {
        incidentId,
        title,
        severity,
        service: serviceName,
        externalSystems,
      },
      'Incident created'
    );

    // Create in external systems
    for (const system of externalSystems) {
      try {
        const integration = this.externalIntegrations.get(system);

        if (integration) {
          const externalId = await integration.createIncident(ticket);
          if (!ticket.externalTicketIds) {
            ticket.externalTicketIds = {};
          }
          ticket.externalTicketIds[system] = externalId;

          this.logger.info(
            { system, externalId, incidentId },
            `Incident created in ${system}`
          );
        }
      } catch (error) {
        this.logger.error(
          { system, error, incidentId },
          `Failed to create incident in ${system}`
        );
      }
    }

    return ticket;
  }

  /**
   * Update incident status
   */
  updateIncidentStatus(
    incidentId: string,
    newStatus: IncidentStatus,
    actor: string,
    details?: string
  ): boolean {
    const ticket = this.incidents.get(incidentId);

    if (!ticket) {
      return false;
    }

    const oldStatus = ticket.status;
    ticket.status = newStatus;

    ticket.timeline.push({
      timestamp: Date.now(),
      action: `status-changed: ${oldStatus} → ${newStatus}`,
      actor,
      details,
    });

    // Record timing metrics
    if (newStatus === 'investigating' && !ticket.metrics?.acknowledgeTime) {
      ticket.metrics!.acknowledgeTime = Date.now() - ticket.createdAt;
    } else if (newStatus === 'mitigating' && !ticket.metrics?.mitigationTime) {
      ticket.metrics!.mitigationTime = Date.now() - (ticket.createdAt + (ticket.metrics?.acknowledgeTime || 0));
    } else if (newStatus === 'resolved' && !ticket.metrics?.resolutionTime) {
      ticket.metrics!.resolutionTime = Date.now() - ticket.createdAt;
    }

    this.logger.info(
      {
        incidentId,
        status: newStatus,
        actor,
      },
      'Incident status updated'
    );

    return true;
  }

  /**
   * Assign incident
   */
  assignIncident(incidentId: string, assignee: string, actor: string): boolean {
    const ticket = this.incidents.get(incidentId);

    if (!ticket) {
      return false;
    }

    ticket.assignedTo = assignee;

    ticket.timeline.push({
      timestamp: Date.now(),
      action: 'assigned',
      actor,
      details: `Assigned to ${assignee}`,
    });

    return true;
  }

  /**
   * Add timeline entry
   */
  addTimelineEntry(
    incidentId: string,
    action: string,
    actor: string,
    details?: string
  ): boolean {
    const ticket = this.incidents.get(incidentId);

    if (!ticket) {
      return false;
    }

    ticket.timeline.push({
      timestamp: Date.now(),
      action,
      actor,
      details,
    });

    return true;
  }

  /**
   * Close incident
   */
  closeIncident(incidentId: string, actor: string, details?: string): boolean {
    const ticket = this.incidents.get(incidentId);

    if (!ticket) {
      return false;
    }

    ticket.status = 'closed';

    ticket.timeline.push({
      timestamp: Date.now(),
      action: 'closed',
      actor,
      details,
    });

    this.logger.info(
      {
        incidentId,
        duration: `${((Date.now() - ticket.createdAt) / 1000 / 60).toFixed(1)}m`,
      },
      'Incident closed'
    );

    return true;
  }

  /**
   * Get incident
   */
  getIncident(incidentId: string): IncidentTicket | undefined {
    return this.incidents.get(incidentId);
  }

  /**
   * Get all incidents
   */
  getAllIncidents(): IncidentTicket[] {
    return Array.from(this.incidents.values());
  }

  /**
   * Get open incidents
   */
  getOpenIncidents(): IncidentTicket[] {
    return Array.from(this.incidents.values()).filter(
      (i) => i.status !== 'closed' && i.status !== 'resolved'
    );
  }

  /**
   * Get incidents by service
   */
  getIncidentsByService(serviceName: string): IncidentTicket[] {
    return Array.from(this.incidents.values()).filter(
      (i) => i.serviceName === serviceName
    );
  }

  /**
   * Get incidents by severity
   */
  getIncidentsBySeverity(severity: IncidentSeverity): IncidentTicket[] {
    return Array.from(this.incidents.values()).filter(
      (i) => i.severity === severity
    );
  }

  /**
   * Get incident statistics
   */
  getStatistics(): {
    totalIncidents: number;
    openIncidents: number;
    resolvedIncidents: number;
    bySeverity: Record<IncidentSeverity, number>;
    avgResolutionTime: number;
    mttr: number; // Mean time to resolution
  } {
    const incidents = Array.from(this.incidents.values());
    const open = incidents.filter((i) => i.status !== 'closed');
    const resolved = incidents.filter((i) => i.status === 'closed');

    const bySeverity: Record<IncidentSeverity, number> = {
      sev1: 0,
      sev2: 0,
      sev3: 0,
      sev4: 0,
    };

    for (const incident of incidents) {
      bySeverity[incident.severity]++;
    }

    const avgResolutionTime =
      resolved.length > 0
        ? resolved.reduce((sum, i) => sum + (i.metrics?.resolutionTime || 0), 0) /
          resolved.length /
          1000 /
          60
        : 0;

    return {
      totalIncidents: incidents.length,
      openIncidents: open.length,
      resolvedIncidents: resolved.length,
      bySeverity,
      avgResolutionTime,
      mttr: avgResolutionTime, // Time from creation to resolution
    };
  }

  /**
   * Export incident report
   */
  exportReport(): string {
    const stats = this.getStatistics();
    const incidents = this.getAllIncidents();

    return JSON.stringify(
      {
        timestamp: Date.now(),
        statistics: stats,
        incidents,
      },
      null,
      2
    );
  }

  /**
   * Print formatted incident report
   */
  printReport(): void {
    const stats = this.getStatistics();
    const openIncidents = this.getOpenIncidents();

    console.log(`
╔════════════════════════════════════════════════════════════╗
║         Incident Response Management Report               ║
╚════════════════════════════════════════════════════════════╝

📊 Statistics:
   Total Incidents: ${stats.totalIncidents}
   Open: ${stats.openIncidents}
   Resolved: ${stats.resolvedIncidents}
   Avg Resolution Time: ${stats.avgResolutionTime.toFixed(1)} minutes
   MTTR: ${stats.mttr.toFixed(1)} minutes

🔴 By Severity:
   Sev1 (Critical): ${stats.bySeverity.sev1}
   Sev2 (High): ${stats.bySeverity.sev2}
   Sev3 (Medium): ${stats.bySeverity.sev3}
   Sev4 (Low): ${stats.bySeverity.sev4}

🚨 Open Incidents: ${openIncidents.length}
${
  openIncidents.length > 0
    ? openIncidents
        .map(
          (i) =>
            `   ${i.id} [${i.severity}] ${i.title}
      Service: ${i.serviceName} | Duration: ${Math.round((Date.now() - i.createdAt) / 1000 / 60)}m | Status: ${i.status}`
        )
        .join('\n\n')
    : '   None'
}

⏰ Generated: ${new Date().toISOString()}
    `);
  }
}

export default IncidentResponseManager;
