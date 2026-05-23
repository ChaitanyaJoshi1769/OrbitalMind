import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { createLogger } from 'pino';
import path from 'path';
import { Orchestrator } from '@orbitalmind/control-plane';
import { ConstellationState } from '@orbitalmind/shared';

const logger = createLogger({
  name: 'gRPCService',
  level: process.env.LOG_LEVEL || 'info',
});

const PROTO_PATH = path.join(__dirname, '../../infrastructure/proto');

interface ServiceImplementation {
  getSatellite: grpc.UntypedServiceImplementation['getSatellite'];
  listSatellites: grpc.UntypedServiceImplementation['listSatellites'];
  getConstellationState: grpc.UntypedServiceImplementation['getConstellationState'];
  updateConstellationState: grpc.UntypedServiceImplementation['updateConstellationState'];
  streamConstellationState: grpc.UntypedServiceImplementation['streamConstellationState'];
  submitTask: grpc.UntypedServiceImplementation['submitTask'];
  getTaskStatus: grpc.UntypedServiceImplementation['getTaskStatus'];
  cancelTask: grpc.UntypedServiceImplementation['cancelTask'];
  listTasks: grpc.UntypedServiceImplementation['listTasks'];
  getThermalMetrics: grpc.UntypedServiceImplementation['getThermalMetrics'];
  getRadiationMetrics: grpc.UntypedServiceImplementation['getRadiationMetrics'];
  getPowerMetrics: grpc.UntypedServiceImplementation['getPowerMetrics'];
  getInferenceMetrics: grpc.UntypedServiceImplementation['getInferenceMetrics'];
  getNetworkMetrics: grpc.UntypedServiceImplementation['getNetworkMetrics'];
}

class GRPCService {
  private server: grpc.Server;
  private orchestrator: Orchestrator;
  private constellationState: ConstellationState;

  constructor(orchestrator: Orchestrator, initialState: ConstellationState) {
    this.server = new grpc.Server();
    this.orchestrator = orchestrator;
    this.constellationState = initialState;
  }

  async start(port: number = 50051): Promise<void> {
    try {
      // Load constellation proto
      const packageDefinition = protoLoader.loadSync(path.join(PROTO_PATH, 'constellation.proto'), {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
      });

      const proto = grpc.loadPackageDefinition(packageDefinition) as any;
      const constellationProto = proto.orbitalmind.v1;

      // Load tasks proto
      const tasksPackageDefinition = protoLoader.loadSync(path.join(PROTO_PATH, 'tasks.proto'), {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
      });

      const tasksProto = grpc.loadPackageDefinition(tasksPackageDefinition) as any;
      const tasksProtoV1 = tasksProto.orbitalmind.v1;

      // Load telemetry proto
      const telemetryPackageDefinition = protoLoader.loadSync(path.join(PROTO_PATH, 'telemetry.proto'), {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
      });

      const telemetryProto = grpc.loadPackageDefinition(telemetryPackageDefinition) as any;
      const telemetryProtoV1 = telemetryProto.orbitalmind.v1;

      // Register services
      const constellationServices = this.createConstellationServices();
      const taskServices = this.createTaskServices();
      const telemetryServices = this.createTelemetryServices();

      this.server.addService(constellationProto.ConstellationService.service, constellationServices as ServiceImplementation);
      this.server.addService(tasksProtoV1.TaskService.service, taskServices as ServiceImplementation);
      this.server.addService(telemetryProtoV1.TelemetryService.service, telemetryServices as ServiceImplementation);

      // Bind server
      this.server.bindAsync(`0.0.0.0:${port}`, grpc.ServerCredentials.createInsecure(), (err, boundPort) => {
        if (err) {
          logger.error({ error: err.message }, 'Failed to bind gRPC server');
          throw err;
        }

        this.server.start();
        logger.info({ port: boundPort }, 'gRPC server started');
      });

      // Graceful shutdown
      process.on('SIGTERM', () => this.stop());
      process.on('SIGINT', () => this.stop());
    } catch (error) {
      logger.error({ error }, 'Failed to start gRPC server');
      throw error;
    }
  }

  private createConstellationServices(): Partial<ServiceImplementation> {
    return {
      getSatellite: (call: any, callback: any) => {
        const { satellite_id } = call.request;
        const satellite = this.constellationState.satellites.find(s => s.id === satellite_id);

        if (!satellite) {
          callback({
            code: grpc.status.NOT_FOUND,
            details: `Satellite ${satellite_id} not found`,
          });
          return;
        }

        callback(null, { satellite });
      },

      listSatellites: (call: any, callback: any) => {
        const { health_filter } = call.request;
        let satellites = [...this.constellationState.satellites];

        if (health_filter && health_filter !== 'all') {
          satellites = satellites.filter(s => s.health.status === health_filter);
        }

        callback(null, {
          satellites,
          total: this.constellationState.satellites.length,
          healthy: this.constellationState.satellites.filter(s => s.health.status === 'healthy').length,
          degraded: this.constellationState.satellites.filter(s => s.health.status === 'degraded').length,
          offline: this.constellationState.satellites.filter(s => s.health.status === 'offline').length,
        });
      },

      getConstellationState: (call: any, callback: any) => {
        callback(null, { state: this.constellationState });
      },

      updateConstellationState: (call: any, callback: any) => {
        this.constellationState = call.request.state;
        callback(null, {});
      },

      streamConstellationState: (call: any) => {
        const interval = setInterval(() => {
          call.write({ state: this.constellationState });
        }, 5000);

        call.on('cancelled', () => clearInterval(interval));
      },
    };
  }

  private createTaskServices(): Partial<ServiceImplementation> {
    const tasks = new Map<string, any>();

    return {
      submitTask: (call: any, callback: any) => {
        const taskId = `task-${Date.now()}`;
        tasks.set(taskId, {
          ...call.request,
          task_id: taskId,
          status: 'QUEUED',
          created_at: Date.now(),
        });

        callback(null, {
          task_id: taskId,
          status: 'QUEUED',
          created_at: Date.now(),
        });
      },

      getTaskStatus: (call: any, callback: any) => {
        const { task_id } = call.request;
        const task = tasks.get(task_id);

        if (!task) {
          callback({
            code: grpc.status.NOT_FOUND,
            details: `Task ${task_id} not found`,
          });
          return;
        }

        callback(null, task);
      },

      cancelTask: (call: any, callback: any) => {
        const { task_id } = call.request;
        const task = tasks.get(task_id);

        if (!task) {
          callback({
            code: grpc.status.NOT_FOUND,
            details: `Task ${task_id} not found`,
          });
          return;
        }

        task.status = 'CANCELLED';
        callback(null, task);
      },

      listTasks: (call: any, callback: any) => {
        const taskArray = Array.from(tasks.values());
        callback(null, {
          tasks: taskArray,
          total: taskArray.length,
        });
      },
    };
  }

  private createTelemetryServices(): Partial<ServiceImplementation> {
    return {
      getThermalMetrics: (call: any, callback: any) => {
        const thermalData = this.constellationState.satellites.map(s => ({
          satellite_id: s.id,
          junction_temperature: s.thermal.junctionTemperature,
          power_dissipation: s.thermal.powerDissipation,
        }));

        const avgTemp =
          thermalData.length > 0 ? thermalData.reduce((sum, d) => sum + d.junction_temperature, 0) / thermalData.length : 0;

        callback(null, {
          timestamp: Date.now(),
          aggregate: {
            average_temperature: avgTemp,
            satellite_count: thermalData.length,
          },
          satellites: thermalData,
        });
      },

      getRadiationMetrics: (call: any, callback: any) => {
        const totalSEU = this.constellationState.satellites.reduce((sum, s) => sum + s.radiation.seuRate24h, 0);

        callback(null, {
          timestamp: Date.now(),
          aggregate: {
            total_seu_events_24h: totalSEU,
            satellite_count: this.constellationState.satellites.length,
          },
        });
      },

      getPowerMetrics: (call: any, callback: any) => {
        const avgBattery =
          this.constellationState.satellites.length > 0
            ? this.constellationState.satellites.reduce((sum, s) => sum + s.power.batteryLevel, 0) /
              this.constellationState.satellites.length
            : 0;

        callback(null, {
          timestamp: Date.now(),
          aggregate: {
            average_battery_level: avgBattery,
            satellite_count: this.constellationState.satellites.length,
          },
        });
      },

      getInferenceMetrics: (call: any, callback: any) => {
        const totalQueued = this.constellationState.satellites.reduce((sum, s) => sum + s.inference.queued, 0);
        const totalProcessing = this.constellationState.satellites.reduce((sum, s) => sum + s.inference.processing, 0);
        const totalCompleted = this.constellationState.satellites.reduce((sum, s) => sum + s.inference.completed, 0);

        callback(null, {
          timestamp: Date.now(),
          aggregate: {
            total_queued: totalQueued,
            total_processing: totalProcessing,
            total_completed: totalCompleted,
            satellite_count: this.constellationState.satellites.length,
          },
        });
      },

      getNetworkMetrics: (call: any, callback: any) => {
        const edges = this.constellationState.topology?.edges || [];
        const healthyLinks = edges.filter(e => e.quality > 0.8).length;
        const avgQuality = edges.length > 0 ? edges.reduce((sum, e) => sum + e.quality, 0) / edges.length : 0;

        callback(null, {
          timestamp: Date.now(),
          aggregate: {
            total_links: edges.length,
            healthy_links: healthyLinks,
            average_link_quality: avgQuality,
          },
        });
      },
    };
  }

  stop(): void {
    this.server.tryShutdown(err => {
      if (err) {
        logger.error({ error: err }, 'Error shutting down gRPC server');
      } else {
        logger.info('gRPC server shut down gracefully');
      }
      process.exit(err ? 1 : 0);
    });
  }
}

// Main execution
async function main(): Promise<void> {
  try {
    const initialState: ConstellationState = {
      timestamp: Date.now(),
      satellites: Array.from({ length: 16 }, (_, i) => ({
        id: `SAT-${String(i).padStart(3, '0')}` as any,
        position: {
          latitude: Math.random() * 180 - 90,
          longitude: Math.random() * 360 - 180,
          altitude: 400 + Math.random() * 100,
        },
        velocity: { x: 0, y: 0, z: 0 },
        health: { status: ('healthy' as const), uptime: 1000000 },
        thermal: { junctionTemperature: 60, powerDissipation: 50, ambientTemperature: -50 },
        radiation: { seuRate24h: 50, lastEvent: Date.now() },
        power: { batteryLevel: 80, solarInput: 200 },
        inference: { queued: 0, processing: 0, completed: 100 },
      })),
      topology: { edges: [] },
      routing: {},
    };

    const orchestrator = {} as any; // Placeholder
    const service = new GRPCService(orchestrator, initialState);
    await service.start(parseInt(process.env.GRPC_PORT || '50051', 10));
  } catch (error) {
    logger.error({ error }, 'Fatal error');
    process.exit(1);
  }
}

main();
