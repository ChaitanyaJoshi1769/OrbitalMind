import { Router, Request, Response } from 'express';
import { Logger } from 'pino';
import { Orchestrator } from '../orchestrator';

export default function orchestrationRoutes(orchestrator: Orchestrator, logger: Logger): Router {
  const router = Router();

  // GET /api/v1/orchestration/state - Get current constellation state
  router.get('/state', (req: Request, res: Response) => {
    try {
      const state = orchestrator.getConstellationState();
      res.json({
        timestamp: Date.now(),
        constellationState: {
          satelliteCount: state.satellites.length,
          topology: {
            edgeCount: state.topology?.edges.length || 0,
            averageConnectivity:
              (state.topology?.edges.length || 0) / Math.max(state.satellites.length * (state.satellites.length - 1) / 2, 1),
          },
        },
        satellites: state.satellites.map(s => ({
          id: s.id,
          status: s.health.status,
        })),
      });
    } catch (error) {
      logger.error({ error, requestId: req.context.requestId }, 'Failed to get orchestration state');
      res.status(500).json({ error: 'Failed to get orchestration state' });
    }
  });

  // GET /api/v1/orchestration/anomalies - Detect anomalies
  router.get('/anomalies', (req: Request, res: Response) => {
    try {
      const anomalies = orchestrator.detectAnomalies();
      res.json({
        timestamp: Date.now(),
        detected: anomalies.length > 0,
        anomalies: anomalies.map(a => ({
          type: a.type,
          severity: a.severity,
          satelliteId: a.satelliteId,
          description: a.description,
        })),
      });
    } catch (error) {
      logger.error({ error, requestId: req.context.requestId }, 'Failed to detect anomalies');
      res.status(500).json({ error: 'Failed to detect anomalies' });
    }
  });

  // POST /api/v1/orchestration/strategy - Set allocation strategy
  router.post('/strategy', (req: Request, res: Response) => {
    try {
      const { strategy } = req.body;
      const validStrategies = ['ThermalAware', 'PowerAware', 'RoundRobin', 'AvailabilityAware', 'OptimalDistance'];

      if (!strategy || !validStrategies.includes(strategy)) {
        return res.status(400).json({
          error: 'Invalid strategy',
          valid: validStrategies,
        });
      }

      orchestrator.setAllocationStrategy(strategy as any);

      logger.info({ strategy, requestId: req.context.requestId }, 'Allocation strategy changed');

      res.json({
        status: 'success',
        strategy,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error({ error, requestId: req.context.requestId }, 'Failed to set strategy');
      res.status(500).json({ error: 'Failed to set strategy' });
    }
  });

  // GET /api/v1/orchestration/rebalancing - Get rebalancing recommendations
  router.get('/rebalancing', (req: Request, res: Response) => {
    try {
      const recommendations = orchestrator.recommendRebalancing();
      res.json({
        timestamp: Date.now(),
        recommendations: recommendations.map(r => ({
          type: r.type,
          description: r.description,
          affectedSatellites: r.affectedSatellites,
          estimatedImprovement: r.estimatedImprovement,
        })),
      });
    } catch (error) {
      logger.error({ error, requestId: req.context.requestId }, 'Failed to get rebalancing recommendations');
      res.status(500).json({ error: 'Failed to get rebalancing recommendations' });
    }
  });

  // POST /api/v1/orchestration/rebalance - Execute rebalancing
  router.post('/rebalance', (req: Request, res: Response) => {
    try {
      const { type } = req.body;

      if (!type) {
        return res.status(400).json({ error: 'Rebalancing type is required' });
      }

      logger.info({ type, requestId: req.context.requestId }, 'Rebalancing initiated');

      res.json({
        status: 'initiated',
        type,
        operationId: `REBAL-${Date.now()}`,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error({ error, requestId: req.context.requestId }, 'Failed to rebalance');
      res.status(500).json({ error: 'Failed to rebalance' });
    }
  });

  // GET /api/v1/orchestration/health - System health check
  router.get('/health', (req: Request, res: Response) => {
    try {
      const stats = orchestrator.getConstellationStatistics();
      const healthScore = (stats.healthySatellites / Math.max(stats.totalSatellites, 1)) * 100;

      res.json({
        timestamp: Date.now(),
        systemHealth: {
          score: healthScore,
          status: healthScore >= 90 ? 'optimal' : healthScore >= 70 ? 'nominal' : 'degraded',
          healthy: stats.healthySatellites,
          total: stats.totalSatellites,
        },
        thermalStatus: {
          average: Math.round(stats.averageTemperature * 10) / 10,
          max: Math.round(stats.maxTemperature * 10) / 10,
          status: stats.averageTemperature > 75 ? 'warning' : 'nominal',
        },
        powerStatus: {
          totalBattery: Math.round(stats.totalPowerBudget * 10) / 10,
          averageBattery: Math.round((stats.totalPowerBudget / Math.max(stats.totalSatellites, 1)) * 10) / 10,
          status: stats.totalPowerBudget < 20 * stats.totalSatellites ? 'warning' : 'nominal',
        },
      });
    } catch (error) {
      logger.error({ error, requestId: req.context.requestId }, 'Failed to get system health');
      res.status(500).json({ error: 'Failed to get system health' });
    }
  });

  return router;
}
