import { Router, Request, Response } from 'express';
import { Logger } from 'pino';
import { Orchestrator } from '../orchestrator';

export default function telemetryRoutes(orchestrator: Orchestrator, logger: Logger): Router {
  const router = Router();

  // GET /api/v1/telemetry/thermal - Thermal telemetry
  router.get('/thermal', (req: Request, res: Response) => {
    try {
      const state = orchestrator.getConstellationState();
      const thermalData = state.satellites.map(sat => ({
        satelliteId: sat.id,
        junctionTemperature: sat.thermal.junctionTemperature,
        powerDissipation: sat.thermal.powerDissipation,
        ambientTemperature: sat.thermal.ambientTemperature,
        status: sat.health.status,
      }));

      const avgTemp =
        thermalData.length > 0
          ? thermalData.reduce((sum, d) => sum + d.junctionTemperature, 0) / thermalData.length
          : 0;
      const maxTemp = thermalData.length > 0 ? Math.max(...thermalData.map(d => d.junctionTemperature)) : 0;
      const minTemp = thermalData.length > 0 ? Math.min(...thermalData.map(d => d.junctionTemperature)) : 0;

      res.json({
        timestamp: Date.now(),
        aggregate: {
          averageTemperature: avgTemp,
          maxTemperature: maxTemp,
          minTemperature: minTemp,
          satelliteCount: thermalData.length,
          overThresholdCount: thermalData.filter(d => d.junctionTemperature > 75).length,
        },
        satellites: thermalData,
      });
    } catch (error) {
      logger.error({ error, requestId: req.context.requestId }, 'Failed to get thermal telemetry');
      res.status(500).json({ error: 'Failed to get thermal telemetry' });
    }
  });

  // GET /api/v1/telemetry/radiation - Radiation events
  router.get('/radiation', (req: Request, res: Response) => {
    try {
      const state = orchestrator.getConstellationState();
      const radiationData = state.satellites.map(sat => ({
        satelliteId: sat.id,
        seuRate24h: sat.radiation.seuRate24h,
        lastEventTime: sat.radiation.lastEvent,
      }));

      const totalSEU = radiationData.reduce((sum, d) => sum + d.seuRate24h, 0);
      const avgSEU = radiationData.length > 0 ? totalSEU / radiationData.length : 0;
      const maxSEU = radiationData.length > 0 ? Math.max(...radiationData.map(d => d.seuRate24h)) : 0;

      res.json({
        timestamp: Date.now(),
        aggregate: {
          totalSEUEvents24h: totalSEU,
          averageSEURate: avgSEU,
          maxSEURate: maxSEU,
          satelliteCount: radiationData.length,
          highRiskCount: radiationData.filter(d => d.seuRate24h > 100).length,
        },
        satellites: radiationData,
      });
    } catch (error) {
      logger.error({ error, requestId: req.context.requestId }, 'Failed to get radiation telemetry');
      res.status(500).json({ error: 'Failed to get radiation telemetry' });
    }
  });

  // GET /api/v1/telemetry/power - Power telemetry
  router.get('/power', (req: Request, res: Response) => {
    try {
      const state = orchestrator.getConstellationState();
      const powerData = state.satellites.map(sat => ({
        satelliteId: sat.id,
        batteryLevel: sat.power.batteryLevel,
        solarInput: sat.power.solarInput,
        status: sat.health.status,
      }));

      const avgBattery =
        powerData.length > 0 ? powerData.reduce((sum, d) => sum + d.batteryLevel, 0) / powerData.length : 0;
      const minBattery = powerData.length > 0 ? Math.min(...powerData.map(d => d.batteryLevel)) : 0;
      const avgSolar = powerData.length > 0 ? powerData.reduce((sum, d) => sum + d.solarInput, 0) / powerData.length : 0;

      res.json({
        timestamp: Date.now(),
        aggregate: {
          averageBatteryLevel: avgBattery,
          minBatteryLevel: minBattery,
          averageSolarInput: avgSolar,
          satelliteCount: powerData.length,
          lowBatteryCount: powerData.filter(d => d.batteryLevel < 20).length,
        },
        satellites: powerData,
      });
    } catch (error) {
      logger.error({ error, requestId: req.context.requestId }, 'Failed to get power telemetry');
      res.status(500).json({ error: 'Failed to get power telemetry' });
    }
  });

  // GET /api/v1/telemetry/inference - Inference metrics
  router.get('/inference', (req: Request, res: Response) => {
    try {
      const state = orchestrator.getConstellationState();
      const inferenceData = state.satellites.map(sat => ({
        satelliteId: sat.id,
        queued: sat.inference.queued,
        processing: sat.inference.processing,
        completed: sat.inference.completed,
      }));

      const totalQueued = inferenceData.reduce((sum, d) => sum + d.queued, 0);
      const totalProcessing = inferenceData.reduce((sum, d) => sum + d.processing, 0);
      const totalCompleted = inferenceData.reduce((sum, d) => sum + d.completed, 0);

      res.json({
        timestamp: Date.now(),
        aggregate: {
          totalQueued,
          totalProcessing,
          totalCompleted,
          totalThroughput: totalCompleted,
          satelliteCount: inferenceData.length,
        },
        satellites: inferenceData,
      });
    } catch (error) {
      logger.error({ error, requestId: req.context.requestId }, 'Failed to get inference telemetry');
      res.status(500).json({ error: 'Failed to get inference telemetry' });
    }
  });

  // GET /api/v1/telemetry/network - Network metrics
  router.get('/network', (req: Request, res: Response) => {
    try {
      const state = orchestrator.getConstellationState();
      const edges = state.topology?.edges || [];

      const healthyLinks = edges.filter(e => e.quality > 0.8).length;
      const avgQuality = edges.length > 0 ? edges.reduce((sum, e) => sum + e.quality, 0) / edges.length : 0;

      res.json({
        timestamp: Date.now(),
        aggregate: {
          totalLinks: edges.length,
          healthyLinks,
          averageLinkQuality: avgQuality,
          networkConnectivity: (healthyLinks / Math.max(edges.length, 1)) * 100,
        },
        topology: {
          edges: edges.slice(0, 100), // Limit to prevent large responses
        },
      });
    } catch (error) {
      logger.error({ error, requestId: req.context.requestId }, 'Failed to get network telemetry');
      res.status(500).json({ error: 'Failed to get network telemetry' });
    }
  });

  return router;
}
