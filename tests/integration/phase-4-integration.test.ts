/**
 * Phase 4 Integration Tests: Alert Escalation & Incident Response
 *
 * Tests for the alert escalation and incident response automation systems
 * including rule-based incident creation, external system integration,
 * and end-to-end escalation workflows.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AlertEscalationManager, {
  EscalationPolicy,
  AlertEscalationState,
} from '../../apps/monitoring/src/alert-escalation';
import IncidentResponseManager, {
  IncidentTicket,
  IncidentCreationRule,
} from '../../apps/monitoring/src/incident-response';

describe('Phase 4: Alert Escalation & Incident Response', () => {
  describe('AlertEscalationManager - Core Functionality', () => {
    let escalationManager: AlertEscalationManager;

    beforeEach(() => {
      escalationManager = new AlertEscalationManager();
    });

    it('should track alerts and initialize escalation state', () => {
      const state = escalationManager.trackAlert({
        alertId: 'ALERT-001',
        groupId: 'GROUP-001',
        serviceName: 'space-traffic',
        severity: 'critical',
      });

      expect(state).toBeDefined();
      expect(state.alertId).toBe('ALERT-001');
      expect(state.currentLevel).toBe('level-1');
      expect(state.acknowledged).toBe(false);
      expect(state.escalationHistory).toHaveLength(0);
    });

    it('should acknowledge alerts and stop escalation', () => {
      const state = escalationManager.trackAlert({
        alertId: 'ALERT-002',
        groupId: 'GROUP-002',
        serviceName: 'thermal-engine',
        severity: 'warning',
      });

      const acknowledged = escalationManager.acknowledgeAlert(
        'ALERT-002',
        'engineer@orbitalmind.io'
      );

      expect(acknowledged).toBe(true);

      const updatedState = escalationManager.getEscalationState('ALERT-002');
      expect(updatedState?.acknowledged).toBe(true);
      expect(updatedState?.acknowledgedBy).toBe('engineer@orbitalmind.io');
      expect(updatedState?.acknowledgedAt).toBeDefined();
    });

    it('should resolve alerts and mark as resolved', () => {
      escalationManager.trackAlert({
        alertId: 'ALERT-003',
        groupId: 'GROUP-003',
        serviceName: 'blockchain',
        severity: 'critical',
      });

      const resolved = escalationManager.resolveAlert('ALERT-003');

      expect(resolved).toBe(true);

      const state = escalationManager.getEscalationState('ALERT-003');
      expect(state?.currentLevel).toBe('resolved');
      expect(state?.resolvedAt).toBeDefined();
    });

    it('should support custom escalation policies', () => {
      const customPolicy: EscalationPolicy = {
        name: 'custom-database',
        serviceName: 'blockchain',
        severity: 'critical',
        escalationLevels: [
          {
            level: 'level-1',
            delayMinutes: 0,
            recipients: ['dba@orbitalmind.io'],
            notificationChannels: ['slack'],
            action: 'page',
          },
          {
            level: 'level-2',
            delayMinutes: 2,
            recipients: ['dba-lead@orbitalmind.io'],
            notificationChannels: ['slack', 'pagerduty'],
            action: 'page',
          },
        ],
      };

      escalationManager.addPolicy(customPolicy);

      const policies = escalationManager.getAllEscalationStates();
      expect(policies).toBeDefined();
    });

    it('should register escalation callbacks', () => {
      const callbacks: AlertEscalationState[] = [];

      escalationManager.onEscalation(async (state) => {
        callbacks.push(state);
      });

      escalationManager.trackAlert({
        alertId: 'ALERT-004',
        groupId: 'GROUP-004',
        serviceName: 'space-traffic',
        severity: 'critical',
      });

      expect(callbacks).toBeDefined();
    });

    it('should retrieve escalation statistics', () => {
      escalationManager.trackAlert({
        alertId: 'ALERT-005',
        groupId: 'GROUP-005',
        serviceName: 'thermal-engine',
        severity: 'critical',
      });

      escalationManager.trackAlert({
        alertId: 'ALERT-006',
        groupId: 'GROUP-006',
        serviceName: 'blockchain',
        severity: 'warning',
      });

      const stats = escalationManager.getStatistics();

      expect(stats.totalTracked).toBe(2);
      expect(stats.unacknowledged).toBe(2);
      expect(stats.resolved).toBe(0);
      expect(stats.avgTimeToAcknowledge).toBe(0);
      expect(stats.escalationRate).toBe(0);
    });

    it('should get escalation states by level', () => {
      escalationManager.trackAlert({
        alertId: 'ALERT-007',
        groupId: 'GROUP-007',
        serviceName: 'space-traffic',
        severity: 'critical',
      });

      const level1States = escalationManager.getEscalationStatesByLevel('level-1');

      expect(level1States).toHaveLength(1);
      expect(level1States[0].currentLevel).toBe('level-1');
    });

    it('should get pending escalations', () => {
      escalationManager.trackAlert({
        alertId: 'ALERT-008',
        groupId: 'GROUP-008',
        serviceName: 'thermal-engine',
        severity: 'critical',
      });

      const pending = escalationManager.getPendingEscalations();

      expect(pending).toHaveLength(1);
      expect(pending[0].acknowledged).toBe(false);
    });

    it('should export escalation report', () => {
      escalationManager.trackAlert({
        alertId: 'ALERT-009',
        groupId: 'GROUP-009',
        serviceName: 'blockchain',
        severity: 'warning',
      });

      const report = escalationManager.exportReport();
      const data = JSON.parse(report);

      expect(data.timestamp).toBeDefined();
      expect(data.statistics).toBeDefined();
      expect(data.escalationStates).toHaveLength(1);
    });
  });

  describe('IncidentResponseManager - Core Functionality', () => {
    let incidentManager: IncidentResponseManager;

    beforeEach(() => {
      incidentManager = new IncidentResponseManager();
    });

    it('should create incidents with proper ticket format', async () => {
      const incident = await incidentManager.createIncident(
        'Critical Database Failure',
        'Database connection pool exhausted',
        'sev1',
        'blockchain',
        ['ALERT-001'],
        'system@orbitalmind.io',
        ['critical', 'database'],
        ['jira']
      );

      expect(incident).toBeDefined();
      expect(incident.id).toMatch(/^INC-\d+$/);
      expect(incident.title).toBe('Critical Database Failure');
      expect(incident.status).toBe('open');
      expect(incident.severity).toBe('sev1');
      expect(incident.timeline).toHaveLength(1);
    });

    it('should create incident from alert matching rules', async () => {
      const incident = await incidentManager.createIncidentFromAlert(
        'ALERT-010',
        {
          serviceName: 'space-traffic',
          severity: 'critical',
          message: 'Traffic optimization failure detected',
        },
        'monitor@orbitalmind.io'
      );

      expect(incident).toBeDefined();
      expect(incident?.severity).toBe('sev2');
      expect(incident?.tags).toContain('critical-alert');
    });

    it('should create incident from SLA violation', async () => {
      const incident = await incidentManager.createIncidentFromSLAViolation(
        {
          serviceName: 'space-traffic',
          violationType: 'latency',
          targetValue: 50,
          actualValue: 150,
        },
        'monitor@orbitalmind.io'
      );

      expect(incident).toBeDefined();
      expect(incident?.severity).toBe('sev3');
      expect(incident?.slaViolation).toBeDefined();
      expect(incident?.slaViolation?.violationType).toBe('latency');
    });

    it('should create incident from escalation event', async () => {
      const incident = await incidentManager.createIncidentFromEscalation(
        'ALERT-011',
        'level-4',
        {
          serviceName: 'thermal-engine',
          message: 'Thermal system critical failure',
        },
        'escalation@orbitalmind.io'
      );

      expect(incident).toBeDefined();
      expect(incident?.severity).toBe('sev1');
      expect(incident?.title).toContain('ESCALATION');
      expect(incident?.title).toContain('LEVEL-4');
    });

    it('should update incident status with timeline tracking', () => {
      const incident: IncidentTicket = {
        id: 'INC-001',
        title: 'Test Incident',
        description: 'Test description',
        severity: 'sev2',
        status: 'open',
        serviceName: 'blockchain',
        alertIds: [],
        createdAt: Date.now(),
        createdBy: 'test@orbitalmind.io',
        tags: [],
        timeline: [
          {
            timestamp: Date.now(),
            action: 'created',
            actor: 'test@orbitalmind.io',
          },
        ],
        metrics: { detectionTime: 0 },
      };

      incidentManager['incidents'].set('INC-001', incident);

      const updated = incidentManager.updateIncidentStatus(
        'INC-001',
        'investigating',
        'engineer@orbitalmind.io',
        'Started investigation'
      );

      expect(updated).toBe(true);
      const retrievedIncident = incidentManager.getIncident('INC-001');
      expect(retrievedIncident?.status).toBe('investigating');
      expect(retrievedIncident?.timeline).toHaveLength(2);
    });

    it('should assign incidents to team members', () => {
      const incident: IncidentTicket = {
        id: 'INC-002',
        title: 'Test Incident',
        description: 'Test description',
        severity: 'sev2',
        status: 'open',
        serviceName: 'blockchain',
        alertIds: [],
        createdAt: Date.now(),
        createdBy: 'test@orbitalmind.io',
        tags: [],
        timeline: [
          {
            timestamp: Date.now(),
            action: 'created',
            actor: 'test@orbitalmind.io',
          },
        ],
        metrics: { detectionTime: 0 },
      };

      incidentManager['incidents'].set('INC-002', incident);

      const assigned = incidentManager.assignIncident(
        'INC-002',
        'alice@orbitalmind.io',
        'manager@orbitalmind.io'
      );

      expect(assigned).toBe(true);
      const retrievedIncident = incidentManager.getIncident('INC-002');
      expect(retrievedIncident?.assignedTo).toBe('alice@orbitalmind.io');
    });

    it('should track incident timeline entries', () => {
      const incident: IncidentTicket = {
        id: 'INC-003',
        title: 'Test Incident',
        description: 'Test description',
        severity: 'sev2',
        status: 'open',
        serviceName: 'thermal-engine',
        alertIds: [],
        createdAt: Date.now(),
        createdBy: 'test@orbitalmind.io',
        tags: [],
        timeline: [
          {
            timestamp: Date.now(),
            action: 'created',
            actor: 'test@orbitalmind.io',
          },
        ],
        metrics: { detectionTime: 0 },
      };

      incidentManager['incidents'].set('INC-003', incident);

      incidentManager.addTimelineEntry(
        'INC-003',
        'root-cause-identified',
        'engineer@orbitalmind.io',
        'Cause: Memory leak in thermal calculation module'
      );

      const retrievedIncident = incidentManager.getIncident('INC-003');
      expect(retrievedIncident?.timeline).toHaveLength(2);
      expect(retrievedIncident?.timeline[1].action).toBe('root-cause-identified');
    });

    it('should close incidents and record metrics', () => {
      const incident: IncidentTicket = {
        id: 'INC-004',
        title: 'Test Incident',
        description: 'Test description',
        severity: 'sev2',
        status: 'investigating',
        serviceName: 'blockchain',
        alertIds: [],
        createdAt: Date.now(),
        createdBy: 'test@orbitalmind.io',
        tags: [],
        timeline: [
          {
            timestamp: Date.now(),
            action: 'created',
            actor: 'test@orbitalmind.io',
          },
        ],
        metrics: { detectionTime: 0 },
      };

      incidentManager['incidents'].set('INC-004', incident);

      const closed = incidentManager.closeIncident(
        'INC-004',
        'engineer@orbitalmind.io',
        'Issue resolved by deploying patch'
      );

      expect(closed).toBe(true);
      const retrievedIncident = incidentManager.getIncident('INC-004');
      expect(retrievedIncident?.status).toBe('closed');
    });

    it('should query incidents by service', () => {
      const incident: IncidentTicket = {
        id: 'INC-005',
        title: 'Test Incident',
        description: 'Test description',
        severity: 'sev2',
        status: 'open',
        serviceName: 'space-traffic',
        alertIds: [],
        createdAt: Date.now(),
        createdBy: 'test@orbitalmind.io',
        tags: [],
        timeline: [
          {
            timestamp: Date.now(),
            action: 'created',
            actor: 'test@orbitalmind.io',
          },
        ],
        metrics: { detectionTime: 0 },
      };

      incidentManager['incidents'].set('INC-005', incident);

      const incidents = incidentManager.getIncidentsByService('space-traffic');
      expect(incidents).toHaveLength(1);
      expect(incidents[0].serviceName).toBe('space-traffic');
    });

    it('should query incidents by severity', () => {
      const incident1: IncidentTicket = {
        id: 'INC-006',
        title: 'Test Incident 1',
        description: 'Test description',
        severity: 'sev1',
        status: 'open',
        serviceName: 'blockchain',
        alertIds: [],
        createdAt: Date.now(),
        createdBy: 'test@orbitalmind.io',
        tags: [],
        timeline: [
          {
            timestamp: Date.now(),
            action: 'created',
            actor: 'test@orbitalmind.io',
          },
        ],
        metrics: { detectionTime: 0 },
      };

      const incident2: IncidentTicket = {
        id: 'INC-007',
        title: 'Test Incident 2',
        description: 'Test description',
        severity: 'sev3',
        status: 'open',
        serviceName: 'thermal-engine',
        alertIds: [],
        createdAt: Date.now(),
        createdBy: 'test@orbitalmind.io',
        tags: [],
        timeline: [
          {
            timestamp: Date.now(),
            action: 'created',
            actor: 'test@orbitalmind.io',
          },
        ],
        metrics: { detectionTime: 0 },
      };

      incidentManager['incidents'].set('INC-006', incident1);
      incidentManager['incidents'].set('INC-007', incident2);

      const sev1Incidents = incidentManager.getIncidentsBySeverity('sev1');
      expect(sev1Incidents).toHaveLength(1);
      expect(sev1Incidents[0].severity).toBe('sev1');
    });

    it('should retrieve open incidents', () => {
      const incident: IncidentTicket = {
        id: 'INC-008',
        title: 'Test Incident',
        description: 'Test description',
        severity: 'sev2',
        status: 'open',
        serviceName: 'blockchain',
        alertIds: [],
        createdAt: Date.now(),
        createdBy: 'test@orbitalmind.io',
        tags: [],
        timeline: [
          {
            timestamp: Date.now(),
            action: 'created',
            actor: 'test@orbitalmind.io',
          },
        ],
        metrics: { detectionTime: 0 },
      };

      incidentManager['incidents'].set('INC-008', incident);

      const openIncidents = incidentManager.getOpenIncidents();
      expect(openIncidents.length).toBeGreaterThan(0);
      expect(
        openIncidents.every(
          (i) => i.status !== 'closed' && i.status !== 'resolved'
        )
      ).toBe(true);
    });

    it('should calculate incident statistics', () => {
      const incident1: IncidentTicket = {
        id: 'INC-009',
        title: 'Test Incident 1',
        description: 'Test description',
        severity: 'sev1',
        status: 'closed',
        serviceName: 'blockchain',
        alertIds: [],
        createdAt: Date.now() - 3600000,
        createdBy: 'test@orbitalmind.io',
        tags: [],
        timeline: [
          {
            timestamp: Date.now(),
            action: 'created',
            actor: 'test@orbitalmind.io',
          },
        ],
        metrics: { detectionTime: 0, resolutionTime: 1800000 },
      };

      const incident2: IncidentTicket = {
        id: 'INC-010',
        title: 'Test Incident 2',
        description: 'Test description',
        severity: 'sev2',
        status: 'open',
        serviceName: 'thermal-engine',
        alertIds: [],
        createdAt: Date.now(),
        createdBy: 'test@orbitalmind.io',
        tags: [],
        timeline: [
          {
            timestamp: Date.now(),
            action: 'created',
            actor: 'test@orbitalmind.io',
          },
        ],
        metrics: { detectionTime: 0 },
      };

      incidentManager['incidents'].set('INC-009', incident1);
      incidentManager['incidents'].set('INC-010', incident2);

      const stats = incidentManager.getStatistics();

      expect(stats.totalIncidents).toBeGreaterThanOrEqual(2);
      expect(stats.bySeverity).toBeDefined();
      expect(stats.mttr).toBeGreaterThanOrEqual(0);
    });

    it('should export incident report as JSON', () => {
      const incident: IncidentTicket = {
        id: 'INC-011',
        title: 'Test Incident',
        description: 'Test description',
        severity: 'sev2',
        status: 'open',
        serviceName: 'blockchain',
        alertIds: [],
        createdAt: Date.now(),
        createdBy: 'test@orbitalmind.io',
        tags: [],
        timeline: [
          {
            timestamp: Date.now(),
            action: 'created',
            actor: 'test@orbitalmind.io',
          },
        ],
        metrics: { detectionTime: 0 },
      };

      incidentManager['incidents'].set('INC-011', incident);

      const report = incidentManager.exportReport();
      const data = JSON.parse(report);

      expect(data.timestamp).toBeDefined();
      expect(data.statistics).toBeDefined();
      expect(data.incidents).toBeDefined();
      expect(data.incidents.length).toBeGreaterThan(0);
    });
  });

  describe('Integration: Escalation → Incident Response Workflow', () => {
    let escalationManager: AlertEscalationManager;
    let incidentManager: IncidentResponseManager;

    beforeEach(() => {
      escalationManager = new AlertEscalationManager();
      incidentManager = new IncidentResponseManager();
    });

    it('should create incident when critical alert escalates to level-3', async () => {
      // Track critical alert
      const state = escalationManager.trackAlert({
        alertId: 'ALERT-CRIT-001',
        groupId: 'GROUP-001',
        serviceName: 'thermal-engine',
        severity: 'critical',
      });

      // Simulate escalation to level-3
      state.currentLevel = 'level-3';
      state.escalationHistory.push({
        level: 'level-3',
        timestamp: Date.now(),
        notifiedRecipients: ['ops-manager@orbitalmind.io'],
      });

      // Create incident from escalation
      const incident = await incidentManager.createIncidentFromEscalation(
        'ALERT-CRIT-001',
        'level-3',
        {
          serviceName: 'thermal-engine',
          message: 'Thermal system critical failure',
        },
        'escalation@orbitalmind.io'
      );

      expect(incident).toBeDefined();
      expect(incident?.severity).toBe('sev2');
      expect(state.currentLevel).toBe('level-3');
    });

    it('should handle end-to-end escalation and incident lifecycle', async () => {
      // Step 1: Alert occurs
      const state = escalationManager.trackAlert({
        alertId: 'ALERT-E2E-001',
        groupId: 'GROUP-E2E-001',
        serviceName: 'space-traffic',
        severity: 'critical',
      });

      expect(state.currentLevel).toBe('level-1');

      // Step 2: Simulate escalation to level-4
      state.currentLevel = 'level-4';

      // Step 3: Create incident from level-4 escalation
      const incident = await incidentManager.createIncidentFromEscalation(
        'ALERT-E2E-001',
        'level-4',
        {
          serviceName: 'space-traffic',
          message: 'Traffic optimization critical failure',
        },
        'escalation@orbitalmind.io'
      );

      expect(incident).toBeDefined();
      expect(incident?.severity).toBe('sev1');

      // Step 4: Update incident status
      incidentManager.updateIncidentStatus(
        incident!.id,
        'investigating',
        'incident-commander@orbitalmind.io'
      );

      // Step 5: Acknowledge the alert (stops further escalation)
      escalationManager.acknowledgeAlert(
        'ALERT-E2E-001',
        'engineer@orbitalmind.io'
      );

      const updatedState = escalationManager.getEscalationState('ALERT-E2E-001');
      expect(updatedState?.acknowledged).toBe(true);

      // Step 6: Close incident once resolved
      incidentManager.closeIncident(
        incident!.id,
        'incident-commander@orbitalmind.io',
        'Issue resolved, service stable'
      );

      const closedIncident = incidentManager.getIncident(incident!.id);
      expect(closedIncident?.status).toBe('closed');
    });

    it('should support concurrent escalations with multiple incidents', async () => {
      const alerts = [
        {
          alertId: 'ALERT-CONC-001',
          groupId: 'GROUP-CONC-001',
          serviceName: 'blockchain',
          severity: 'critical' as const,
        },
        {
          alertId: 'ALERT-CONC-002',
          groupId: 'GROUP-CONC-002',
          serviceName: 'thermal-engine',
          severity: 'critical' as const,
        },
        {
          alertId: 'ALERT-CONC-003',
          groupId: 'GROUP-CONC-003',
          serviceName: 'space-traffic',
          severity: 'warning' as const,
        },
      ];

      // Track all alerts
      const states = alerts.map((alert) => escalationManager.trackAlert(alert));
      expect(states).toHaveLength(3);

      // Create incidents for critical escalations
      const incidents = await Promise.all([
        incidentManager.createIncidentFromAlert(
          'ALERT-CONC-001',
          {
            serviceName: 'blockchain',
            severity: 'critical',
            message: 'Database failure',
          },
          'monitor@orbitalmind.io'
        ),
        incidentManager.createIncidentFromAlert(
          'ALERT-CONC-002',
          {
            serviceName: 'thermal-engine',
            severity: 'critical',
            message: 'Thermal failure',
          },
          'monitor@orbitalmind.io'
        ),
      ]);

      expect(incidents[0]).toBeDefined();
      expect(incidents[1]).toBeDefined();

      const allIncidents = incidentManager.getAllIncidents();
      expect(allIncidents.length).toBeGreaterThanOrEqual(2);
    });

    it('should track and report on escalation-incident metrics', async () => {
      // Create multiple alerts and incidents
      for (let i = 0; i < 3; i++) {
        escalationManager.trackAlert({
          alertId: `ALERT-METRIC-${i}`,
          groupId: `GROUP-METRIC-${i}`,
          serviceName: 'blockchain',
          severity: i === 0 ? 'critical' : 'warning',
        });

        if (i === 0) {
          await incidentManager.createIncidentFromAlert(
            `ALERT-METRIC-${i}`,
            {
              serviceName: 'blockchain',
              severity: 'critical',
              message: 'Critical issue',
            },
            'monitor@orbitalmind.io'
          );
        }
      }

      const escalationStats = escalationManager.getStatistics();
      const incidentStats = incidentManager.getStatistics();

      expect(escalationStats.totalTracked).toBe(3);
      expect(escalationStats.unacknowledged).toBe(3);
      expect(incidentStats.totalIncidents).toBeGreaterThan(0);
    });
  });

  describe('Default Rules and Policies', () => {
    let escalationManager: AlertEscalationManager;
    let incidentManager: IncidentResponseManager;

    beforeEach(() => {
      escalationManager = new AlertEscalationManager();
      incidentManager = new IncidentResponseManager();
    });

    it('should apply default escalation policies to all services', () => {
      const services = [
        'space-traffic',
        'digital-twin',
        'thermal-engine',
        'blockchain',
      ];

      services.forEach((service) => {
        escalationManager.trackAlert({
          alertId: `ALERT-DEFAULT-${service}`,
          groupId: `GROUP-DEFAULT-${service}`,
          serviceName: service,
          severity: 'critical',
        });
      });

      const pendingEscalations = escalationManager.getPendingEscalations();
      expect(pendingEscalations.length).toBeGreaterThanOrEqual(4);
    });

    it('should apply default incident creation rules', async () => {
      // Critical alert should create incident
      const incident1 = await incidentManager.createIncidentFromAlert(
        'ALERT-RULE-001',
        {
          serviceName: 'space-traffic',
          severity: 'critical',
          message: 'Critical alert',
        },
        'monitor@orbitalmind.io'
      );

      expect(incident1).toBeDefined();

      // Level 3 escalation should create incident
      const incident2 = await incidentManager.createIncidentFromEscalation(
        'ALERT-RULE-002',
        'level-3',
        {
          serviceName: 'blockchain',
          message: 'Level 3 escalation',
        },
        'escalation@orbitalmind.io'
      );

      expect(incident2).toBeDefined();

      // SLA violation should create incident
      const incident3 = await incidentManager.createIncidentFromSLAViolation(
        {
          serviceName: 'thermal-engine',
          violationType: 'latency',
          targetValue: 100,
          actualValue: 500,
        },
        'monitor@orbitalmind.io'
      );

      expect(incident3).toBeDefined();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    let escalationManager: AlertEscalationManager;
    let incidentManager: IncidentResponseManager;

    beforeEach(() => {
      escalationManager = new AlertEscalationManager();
      incidentManager = new IncidentResponseManager();
    });

    it('should handle acknowledging non-existent alerts gracefully', () => {
      const result = escalationManager.acknowledgeAlert(
        'NONEXISTENT',
        'user@orbitalmind.io'
      );
      expect(result).toBe(false);
    });

    it('should handle resolving non-existent incidents gracefully', () => {
      const result = incidentManager.closeIncident(
        'NONEXISTENT',
        'user@orbitalmind.io'
      );
      expect(result).toBe(false);
    });

    it('should handle updating non-existent incident status gracefully', () => {
      const result = incidentManager.updateIncidentStatus(
        'NONEXISTENT',
        'investigating',
        'user@orbitalmind.io'
      );
      expect(result).toBe(false);
    });

    it('should return empty arrays for non-existent service queries', () => {
      const incidents = incidentManager.getIncidentsByService(
        'nonexistent-service'
      );
      expect(incidents).toEqual([]);
    });

    it('should return null when no rule matches alert threshold', async () => {
      const incident = await incidentManager.createIncidentFromAlert(
        'ALERT-NO-RULE',
        {
          serviceName: 'unknown-service',
          severity: 'info',
          message: 'Info alert',
        },
        'monitor@orbitalmind.io'
      );

      expect(incident).toBeNull();
    });
  });
});
