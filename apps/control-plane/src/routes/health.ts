import { Router, Request, Response } from 'express';
import { Logger } from 'pino';

export default function healthRoutes(logger: Logger): Router {
  const router = Router();

  // GET /api/v1/health - Health check
  router.get('/', (req: Request, res: Response) => {
    res.json({
      status: 'operational',
      timestamp: Date.now(),
      uptime: process.uptime(),
      memory: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
      requestId: req.context.requestId,
    });
  });

  // GET /api/v1/health/ready - Readiness check
  router.get('/ready', (req: Request, res: Response) => {
    res.json({
      ready: true,
      timestamp: Date.now(),
    });
  });

  // GET /api/v1/health/live - Liveness check
  router.get('/live', (req: Request, res: Response) => {
    res.json({
      alive: true,
      timestamp: Date.now(),
    });
  });

  return router;
}
