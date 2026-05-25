/**
 * OrbitalMind Alert Notification System
 *
 * Extensible alerting system supporting multiple channels:
 * - Console notifications
 * - File logging
 * - Email (stub for external integration)
 * - Webhook callbacks (stub for external integration)
 * - Slack integration (stub for external integration)
 */

import pino from 'pino';
import { PerformanceAlert } from './optimization-monitor';

/**
 * Alert notification handler interface
 */
export interface AlertNotificationHandler {
  handle(alert: PerformanceAlert): Promise<void>;
}

/**
 * Alert notification configuration
 */
export interface AlertNotificationConfig {
  console?: boolean;
  file?: string;
  email?: {
    recipients: string[];
    subject: (alert: PerformanceAlert) => string;
  };
  webhook?: {
    url: string;
    headers?: Record<string, string>;
  };
  slack?: {
    webhookUrl: string;
    channel?: string;
  };
}

/**
 * Console notification handler
 */
export class ConsoleAlertHandler implements AlertNotificationHandler {
  private logger = pino();

  async handle(alert: PerformanceAlert): Promise<void> {
    const severity = alert.severity.toUpperCase();
    const message = `[${severity}] ${alert.serviceName}: ${alert.message}`;

    switch (alert.severity) {
      case 'critical':
        this.logger.error({ alert }, message);
        break;
      case 'warning':
        this.logger.warn({ alert }, message);
        break;
      default:
        this.logger.info({ alert }, message);
    }
  }
}

/**
 * File-based alert logging handler
 */
export class FileAlertHandler implements AlertNotificationHandler {
  constructor(private filePath: string) {}

  async handle(alert: PerformanceAlert): Promise<void> {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${alert.severity.toUpperCase()}: ${alert.serviceName} - ${alert.message}\n`;

    try {
      const fs = await import('fs/promises');
      await fs.appendFile(this.filePath, logEntry);
    } catch (error) {
      console.error('Failed to write alert to file:', error);
    }
  }
}

/**
 * Email notification handler (stub)
 */
export class EmailAlertHandler implements AlertNotificationHandler {
  constructor(private recipients: string[], private subjectFormatter: (alert: PerformanceAlert) => string) {}

  async handle(alert: PerformanceAlert): Promise<void> {
    // This would integrate with an email service (SendGrid, AWS SES, etc.)
    // For now, this is a stub that logs the action
    console.log(`[EMAIL] Sending alert to ${this.recipients.join(', ')}`);
    console.log(`Subject: ${this.subjectFormatter(alert)}`);
    console.log(`Body: ${alert.message}`);
    // TODO: Implement actual email sending
  }
}

/**
 * Webhook notification handler
 */
export class WebhookAlertHandler implements AlertNotificationHandler {
  constructor(private url: string, private headers: Record<string, string> = {}) {}

  async handle(alert: PerformanceAlert): Promise<void> {
    try {
      const payload = {
        alertId: alert.alertId,
        serviceName: alert.serviceName,
        severity: alert.severity,
        message: alert.message,
        timestamp: alert.timestamp,
        expectedValue: alert.expectedValue,
        actualValue: alert.actualValue,
      };

      // In a real implementation, this would make an HTTP request
      console.log(`[WEBHOOK] POST ${this.url}`);
      console.log(`Headers: ${JSON.stringify(this.headers)}`);
      console.log(`Payload: ${JSON.stringify(payload, null, 2)}`);

      // Example (commented out for now):
      // const response = await fetch(this.url, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json', ...this.headers },
      //   body: JSON.stringify(payload),
      // });
      // if (!response.ok) {
      //   throw new Error(`Webhook failed: ${response.statusText}`);
      // }
    } catch (error) {
      console.error('Failed to send webhook:', error);
    }
  }
}

/**
 * Slack notification handler (stub)
 */
export class SlackAlertHandler implements AlertNotificationHandler {
  constructor(private webhookUrl: string, private channel?: string) {}

  async handle(alert: PerformanceAlert): Promise<void> {
    try {
      const color = alert.severity === 'critical' ? 'danger' : alert.severity === 'warning' ? 'warning' : 'good';

      const payload = {
        channel: this.channel,
        attachments: [
          {
            color,
            title: `${alert.severity.toUpperCase()}: ${alert.serviceName}`,
            text: alert.message,
            fields: [
              {
                title: 'Expected Value',
                value: `${alert.expectedValue}`,
                short: true,
              },
              {
                title: 'Actual Value',
                value: `${alert.actualValue}`,
                short: true,
              },
              {
                title: 'Metric',
                value: alert.metricName,
                short: true,
              },
              {
                title: 'Alert ID',
                value: alert.alertId,
                short: true,
              },
            ],
            footer: 'OrbitalMind Optimization',
            ts: Math.floor(alert.timestamp / 1000),
          },
        ],
      };

      // In a real implementation, this would make an HTTP request
      console.log(`[SLACK] POST ${this.webhookUrl}`);
      console.log(`Payload: ${JSON.stringify(payload, null, 2)}`);

      // Example (commented out for now):
      // const response = await fetch(this.webhookUrl, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(payload),
      // });
      // if (!response.ok) {
      //   throw new Error(`Slack notification failed: ${response.statusText}`);
      // }
    } catch (error) {
      console.error('Failed to send Slack notification:', error);
    }
  }
}

/**
 * Alert notification manager
 */
export class AlertNotificationManager {
  private handlers: AlertNotificationHandler[] = [];
  private logger = pino();

  /**
   * Add notification handler
   */
  addHandler(handler: AlertNotificationHandler): void {
    this.handlers.push(handler);
  }

  /**
   * Create from configuration
   */
  static createFromConfig(config: AlertNotificationConfig): AlertNotificationManager {
    const manager = new AlertNotificationManager();

    if (config.console) {
      manager.addHandler(new ConsoleAlertHandler());
    }

    if (config.file) {
      manager.addHandler(new FileAlertHandler(config.file));
    }

    if (config.email) {
      manager.addHandler(
        new EmailAlertHandler(config.email.recipients, config.email.subject)
      );
    }

    if (config.webhook) {
      manager.addHandler(
        new WebhookAlertHandler(config.webhook.url, config.webhook.headers)
      );
    }

    if (config.slack) {
      manager.addHandler(new SlackAlertHandler(config.slack.webhookUrl, config.slack.channel));
    }

    return manager;
  }

  /**
   * Send alert to all handlers
   */
  async notifyAlert(alert: PerformanceAlert): Promise<void> {
    this.logger.debug({ alert }, 'Routing alert to notification handlers');

    const results = await Promise.allSettled(
      this.handlers.map(handler => handler.handle(alert))
    );

    // Log any failures
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        this.logger.error(
          { error: result.reason, handlerIndex: index },
          'Alert notification handler failed'
        );
      }
    });
  }

  /**
   * Notify multiple alerts
   */
  async notifyAlerts(alerts: PerformanceAlert[]): Promise<void> {
    await Promise.all(alerts.map(alert => this.notifyAlert(alert)));
  }
}

export default AlertNotificationManager;
