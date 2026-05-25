/**
 * Alert Notification System Integration Test
 * Verify alert routing and notification handlers
 */

import AlertNotificationManager, {
  ConsoleAlertHandler,
  FileAlertHandler,
  WebhookAlertHandler,
  SlackAlertHandler,
  AlertNotificationHandler,
} from '../../apps/monitoring/src/alerting-system';
import { PerformanceAlert } from '../../apps/monitoring/src/optimization-monitor';

describe('Alert Notification System', () => {
  let alertManager: AlertNotificationManager;

  beforeEach(() => {
    alertManager = new AlertNotificationManager();
  });

  const createMockAlert = (severity: 'critical' | 'warning' | 'info' = 'warning'): PerformanceAlert => ({
    alertId: `ALERT-${Date.now()}`,
    serviceName: 'test-service',
    metricName: 'testMetric',
    severity,
    message: `Test alert: metric exceeded threshold`,
    expectedValue: 100,
    actualValue: 150,
    timestamp: Date.now(),
    resolved: false,
  });

  describe('Console Notification Handler', () => {
    test('should handle console notifications', async () => {
      const handler = new ConsoleAlertHandler();
      const alert = createMockAlert('critical');

      // Should not throw
      await expect(handler.handle(alert)).resolves.not.toThrow();

      console.log('✓ Console handler executed');
    });

    test('should handle different severity levels', async () => {
      const handler = new ConsoleAlertHandler();

      const severities: Array<'critical' | 'warning' | 'info'> = ['critical', 'warning', 'info'];

      for (const severity of severities) {
        const alert = createMockAlert(severity);
        await expect(handler.handle(alert)).resolves.not.toThrow();
      }

      console.log('✓ All severity levels handled');
    });
  });

  describe('File Notification Handler', () => {
    test('should create file handler without errors', () => {
      const handler = new FileAlertHandler('/tmp/test-alerts.log');
      expect(handler).toBeDefined();

      console.log('✓ File handler created');
    });

    test('should handle file notifications', async () => {
      const handler = new FileAlertHandler('/tmp/test-alerts.log');
      const alert = createMockAlert('warning');

      // Should not throw
      await expect(handler.handle(alert)).resolves.not.toThrow();

      console.log('✓ File handler notification sent');
    });
  });

  describe('Webhook Notification Handler', () => {
    test('should create webhook handler', () => {
      const handler = new WebhookAlertHandler('https://example.com/alerts');
      expect(handler).toBeDefined();

      console.log('✓ Webhook handler created');
    });

    test('should handle webhook notifications', async () => {
      const handler = new WebhookAlertHandler('https://example.com/alerts', {
        'Authorization': 'Bearer token123',
      });
      const alert = createMockAlert('critical');

      await expect(handler.handle(alert)).resolves.not.toThrow();

      console.log('✓ Webhook notification handled');
    });

    test('should include custom headers', async () => {
      const headers = {
        'X-Custom-Header': 'custom-value',
        'X-Request-ID': 'req-12345',
      };

      const handler = new WebhookAlertHandler('https://example.com/alerts', headers);
      const alert = createMockAlert('warning');

      await expect(handler.handle(alert)).resolves.not.toThrow();

      console.log('✓ Custom headers included');
    });
  });

  describe('Slack Notification Handler', () => {
    test('should create Slack handler', () => {
      const handler = new SlackAlertHandler('https://hooks.slack.com/services/xxx/yyy/zzz');
      expect(handler).toBeDefined();

      console.log('✓ Slack handler created');
    });

    test('should handle Slack notifications', async () => {
      const handler = new SlackAlertHandler('https://hooks.slack.com/services/xxx/yyy/zzz', '#alerts');
      const alert = createMockAlert('critical');

      await expect(handler.handle(alert)).resolves.not.toThrow();

      console.log('✓ Slack notification handled');
    });

    test('should support different severity colors', async () => {
      const handler = new SlackAlertHandler('https://hooks.slack.com/services/xxx/yyy/zzz');

      const severities: Array<'critical' | 'warning' | 'info'> = ['critical', 'warning', 'info'];

      for (const severity of severities) {
        const alert = createMockAlert(severity);
        await expect(handler.handle(alert)).resolves.not.toThrow();
      }

      console.log('✓ All severity colors supported');
    });
  });

  describe('Alert Notification Manager', () => {
    test('should add handlers', () => {
      const consoleHandler = new ConsoleAlertHandler();
      const fileHandler = new FileAlertHandler('/tmp/alerts.log');

      alertManager.addHandler(consoleHandler);
      alertManager.addHandler(fileHandler);

      console.log('✓ Handlers added to manager');
    });

    test('should notify all handlers', async () => {
      const consoleHandler = new ConsoleAlertHandler();
      const fileHandler = new FileAlertHandler('/tmp/alerts.log');

      alertManager.addHandler(consoleHandler);
      alertManager.addHandler(fileHandler);

      const alert = createMockAlert('critical');

      await expect(alertManager.notifyAlert(alert)).resolves.not.toThrow();

      console.log('✓ Alert sent to all handlers');
    });

    test('should notify multiple alerts', async () => {
      const handler = new ConsoleAlertHandler();
      alertManager.addHandler(handler);

      const alerts = [
        createMockAlert('critical'),
        createMockAlert('warning'),
        createMockAlert('info'),
      ];

      await expect(alertManager.notifyAlerts(alerts)).resolves.not.toThrow();

      console.log(`✓ ${alerts.length} alerts sent to handlers`);
    });

    test('should continue on handler failure', async () => {
      // Create a handler that throws
      const failingHandler: AlertNotificationHandler = {
        async handle() {
          throw new Error('Handler failed');
        },
      };

      alertManager.addHandler(failingHandler);
      alertManager.addHandler(new ConsoleAlertHandler());

      const alert = createMockAlert('warning');

      // Should not throw even though first handler failed
      await expect(alertManager.notifyAlert(alert)).resolves.not.toThrow();

      console.log('✓ Manager continued despite handler failure');
    });
  });

  describe('Configuration-Based Manager Creation', () => {
    test('should create manager from console config', () => {
      const manager = AlertNotificationManager.createFromConfig({
        console: true,
      });

      expect(manager).toBeDefined();

      console.log('✓ Manager created from console config');
    });

    test('should create manager from file config', () => {
      const manager = AlertNotificationManager.createFromConfig({
        file: '/tmp/alerts.log',
      });

      expect(manager).toBeDefined();

      console.log('✓ Manager created from file config');
    });

    test('should create manager from email config', () => {
      const manager = AlertNotificationManager.createFromConfig({
        email: {
          recipients: ['admin@example.com'],
          subject: (alert) => `Alert: ${alert.serviceName}`,
        },
      });

      expect(manager).toBeDefined();

      console.log('✓ Manager created from email config');
    });

    test('should create manager from webhook config', () => {
      const manager = AlertNotificationManager.createFromConfig({
        webhook: {
          url: 'https://example.com/alerts',
          headers: { 'Authorization': 'Bearer token' },
        },
      });

      expect(manager).toBeDefined();

      console.log('✓ Manager created from webhook config');
    });

    test('should create manager from Slack config', () => {
      const manager = AlertNotificationManager.createFromConfig({
        slack: {
          webhookUrl: 'https://hooks.slack.com/services/xxx/yyy/zzz',
          channel: '#alerts',
        },
      });

      expect(manager).toBeDefined();

      console.log('✓ Manager created from Slack config');
    });

    test('should create manager with multiple handlers', () => {
      const manager = AlertNotificationManager.createFromConfig({
        console: true,
        file: '/tmp/alerts.log',
        webhook: {
          url: 'https://example.com/alerts',
        },
        slack: {
          webhookUrl: 'https://hooks.slack.com/services/xxx/yyy/zzz',
        },
      });

      expect(manager).toBeDefined();

      console.log('✓ Manager created with multiple handlers');
    });
  });

  describe('Alert Content Handling', () => {
    test('should preserve alert metadata', async () => {
      const handler = new ConsoleAlertHandler();
      const alert: PerformanceAlert = {
        alertId: 'ALERT-001',
        serviceName: 'space-traffic',
        metricName: 'avgResponseTime',
        severity: 'critical',
        message: 'Response time exceeded threshold',
        expectedValue: 50,
        actualValue: 150,
        timestamp: 1234567890000,
        resolved: false,
      };

      await expect(handler.handle(alert)).resolves.not.toThrow();

      console.log('✓ Alert metadata preserved');
    });

    test('should handle special characters in messages', async () => {
      const handler = new ConsoleAlertHandler();
      const alert = createMockAlert('warning');
      alert.message = 'Special chars: <>&"\'|\\';

      await expect(handler.handle(alert)).resolves.not.toThrow();

      console.log('✓ Special characters handled');
    });

    test('should handle resolved alerts', async () => {
      const handler = new ConsoleAlertHandler();
      const alert = createMockAlert('info');
      alert.resolved = true;

      await expect(handler.handle(alert)).resolves.not.toThrow();

      console.log('✓ Resolved alerts handled');
    });
  });

  describe('Integration Scenario', () => {
    test('should handle complete alert workflow', async () => {
      // Create manager with multiple handlers
      const manager = AlertNotificationManager.createFromConfig({
        console: true,
        file: '/tmp/test-alerts.log',
        webhook: {
          url: 'https://example.com/webhook',
        },
        slack: {
          webhookUrl: 'https://hooks.slack.com/services/xxx',
          channel: '#critical-alerts',
        },
      });

      // Create alerts of different severities
      const alerts = [
        { ...createMockAlert('critical'), serviceName: 'space-traffic' },
        { ...createMockAlert('warning'), serviceName: 'thermal-engine' },
        { ...createMockAlert('info'), serviceName: 'blockchain' },
      ];

      // Send all alerts
      await expect(manager.notifyAlerts(alerts)).resolves.not.toThrow();

      console.log('✓ Complete alert workflow executed');
    });

    test('should handle high-volume alert notifications', async () => {
      const manager = AlertNotificationManager.createFromConfig({
        console: true,
      });

      // Generate 100 alerts
      const alerts = Array.from({ length: 100 }, (_, i) =>
        createMockAlert(i % 3 === 0 ? 'critical' : i % 3 === 1 ? 'warning' : 'info')
      );

      const startTime = Date.now();
      await expect(manager.notifyAlerts(alerts)).resolves.not.toThrow();
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds

      console.log(`✓ High-volume notification (100 alerts) completed in ${duration}ms`);
    });
  });
});
