import { createLogger } from 'pino';
import { APIServer } from './api-server';
import { Orchestrator } from './orchestrator';
import { ConstellationState } from '@orbitalmind/shared';

const logger = createLogger({
  name: 'ControlPlane',
  level: process.env.LOG_LEVEL || 'info',
});

async function main(): Promise<void> {
  try {
    logger.info('OrbitalMind Control Plane starting...');

    // Initialize orchestrator with mock constellation state
    const initialState: ConstellationState = {
      timestamp: Date.now(),
      satellites: Array.from({ length: 16 }, (_, i) => ({
        id: `SAT-${String(i).padStart(3, '0')}` as any,
        position: {
          latitude: Math.random() * 180 - 90,
          longitude: Math.random() * 360 - 180,
          altitude: 400 + Math.random() * 100,
        },
        velocity: {
          x: Math.random() * 100 - 50,
          y: Math.random() * 100 - 50,
          z: Math.random() * 100 - 50,
        },
        health: {
          status: i < 14 ? ('healthy' as const) : ('degraded' as const),
          uptime: Math.random() * 1000000,
        },
        thermal: {
          junctionTemperature: 60 + Math.random() * 20,
          powerDissipation: 50 + Math.random() * 30,
          ambientTemperature: -50,
        },
        radiation: {
          seuRate24h: Math.floor(Math.random() * 150),
          lastEvent: Date.now(),
        },
        power: {
          batteryLevel: 70 + Math.random() * 30,
          solarInput: 200 + Math.random() * 50,
        },
        inference: {
          queued: Math.floor(Math.random() * 5),
          processing: Math.floor(Math.random() * 3),
          completed: Math.floor(Math.random() * 1000),
        },
      })),
      topology: {
        edges: Array.from({ length: 30 }, (_, i) => ({
          source: `SAT-${String(Math.floor(Math.random() * 16)).padStart(3, '0')}` as any,
          destination: `SAT-${String(Math.floor(Math.random() * 16)).padStart(3, '0')}` as any,
          quality: 0.5 + Math.random() * 0.5,
        })),
      },
      routing: {},
    };

    const orchestrator = new Orchestrator(initialState);

    // Initialize API server
    const apiServer = new APIServer(orchestrator, {
      port: parseInt(process.env.PORT || '8000', 10),
      host: process.env.HOST || '0.0.0.0',
      env: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development',
    });

    await apiServer.start();

    // Update constellation state periodically (simulation)
    setInterval(() => {
      const state = orchestrator.getConstellationState();
      state.satellites.forEach(sat => {
        sat.position.latitude += (Math.random() - 0.5) * 2;
        sat.position.longitude += (Math.random() - 0.5) * 2;
        sat.thermal.junctionTemperature += (Math.random() - 0.5) * 2;
        sat.radiation.seuRate24h = Math.floor(Math.random() * 150);
      });
      state.timestamp = Date.now();

      apiServer.broadcastUpdate('constellation', state);
    }, 5000);

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      await apiServer.stop();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully');
      await apiServer.stop();
      process.exit(0);
    });
  } catch (error) {
    logger.error(error, 'Fatal error in control plane');
    process.exit(1);
  }
}

main();
