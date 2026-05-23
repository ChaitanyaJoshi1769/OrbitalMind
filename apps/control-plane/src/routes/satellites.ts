import { Router, Request, Response } from 'express';
import { Logger } from 'pino';
import { Orchestrator } from '../orchestrator';

export default function satelliteRoutes(orchestrator: Orchestrator, logger: Logger): Router {
  const router = Router();

  // GET /api/v1/satellites - List all satellites
  router.get('/', (req: Request, res: Response) => {
    try {
      const state = orchestrator.getConstellationState();
      const satellites = state.satellites.map(sat => ({
        id: sat.id,
        position: sat.position,
        health: sat.health,
        thermal: sat.thermal,
        radiation: sat.radiation,
        power: sat.power,
        inference: sat.inference,
      }));

      res.json({
        total: satellites.length,
        healthy: satellites.filter(s => s.health.status === 'healthy').length,
        degraded: satellites.filter(s => s.health.status === 'degraded').length,
        offline: satellites.filter(s => s.health.status === 'offline').length,
        satellites,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error({ error, requestId: req.context.requestId }, 'Failed to list satellites');
      res.status(500).json({ error: 'Failed to list satellites' });
    }
  });

  // GET /api/v1/satellites/:id - Get satellite details
  router.get('/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const state = orchestrator.getConstellationState();
      const satellite = state.satellites.find(s => s.id === id);

      if (!satellite) {
        return res.status(404).json({ error: 'Satellite not found', id });
      }

      res.json({
        satellite,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error({ error, requestId: req.context.requestId }, 'Failed to get satellite');
      res.status(500).json({ error: 'Failed to get satellite' });
    }
  });

  // GET /api/v1/satellites/:id/telemetry - Get satellite telemetry
  router.get('/:id/telemetry', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const state = orchestrator.getConstellationState();
      const satellite = state.satellites.find(s => s.id === id);

      if (!satellite) {
        return res.status(404).json({ error: 'Satellite not found', id });
      }

      res.json({
        id: satellite.id,
        position: satellite.position,
        velocity: satellite.velocity,
        thermal: satellite.thermal,
        power: satellite.power,
        radiation: satellite.radiation,
        inference: satellite.inference,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error({ error, requestId: req.context.requestId }, 'Failed to get satellite telemetry');
      res.status(500).json({ error: 'Failed to get satellite telemetry' });
    }
  });

  // PATCH /api/v1/satellites/:id/command - Send command to satellite
  router.patch('/:id/command', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { command, parameters } = req.body;

      if (!command) {
        return res.status(400).json({ error: 'Command is required' });
      }

      const state = orchestrator.getConstellationState();
      const satellite = state.satellites.find(s => s.id === id);

      if (!satellite) {
        return res.status(404).json({ error: 'Satellite not found', id });
      }

      logger.info({ satelliteId: id, command, parameters, requestId: req.context.requestId }, 'Satellite command received');

      res.json({
        status: 'accepted',
        command,
        satelliteId: id,
        commandId: `CMD-${Date.now()}`,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error({ error, requestId: req.context.requestId }, 'Failed to send satellite command');
      res.status(500).json({ error: 'Failed to send satellite command' });
    }
  });

  // GET /api/v1/satellites/statistics - Constellation statistics
  router.get('/aggregate/statistics', (req: Request, res: Response) => {
    try {
      const stats = orchestrator.getConstellationStatistics();
      res.json({
        ...stats,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error({ error, requestId: req.context.requestId }, 'Failed to get constellation statistics');
      res.status(500).json({ error: 'Failed to get constellation statistics' });
    }
  });

  return router;
}
