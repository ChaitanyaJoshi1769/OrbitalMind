import { Router, Request, Response } from 'express';
import { Logger } from 'pino';
import { Orchestrator } from '../orchestrator';
import { InferenceTask } from '@orbitalmind/shared';
import { v4 as uuidv4 } from 'uuid';

interface TaskSubmission {
  modelId: string;
  priority: 'Critical' | 'High' | 'Normal' | 'Low';
  input: unknown;
  timeout?: number;
  redundancy?: boolean;
}

interface TaskResponse {
  taskId: string;
  modelId: string;
  priority: string;
  status: string;
  assignedSatellite?: string;
  createdAt: number;
  estimatedCompletionTime?: number;
}

const pendingTasks = new Map<string, { submission: TaskSubmission; createdAt: number; assignedSatellite?: string }>();

export default function taskRoutes(orchestrator: Orchestrator, logger: Logger): Router {
  const router = Router();

  // POST /api/v1/tasks - Submit inference task
  router.post('/', (req: Request, res: Response) => {
    try {
      const submission: TaskSubmission = req.body;

      if (!submission.modelId) {
        return res.status(400).json({ error: 'modelId is required' });
      }

      const taskId = uuidv4();
      const createdAt = Date.now();

      // Store task
      pendingTasks.set(taskId, {
        submission,
        createdAt,
      });

      // Attempt allocation
      const state = orchestrator.getConstellationState();
      let assignedSatellite: string | undefined;

      if (state.satellites.length > 0) {
        const healthySatellites = state.satellites.filter(s => s.health.status === 'healthy');
        if (healthySatellites.length > 0) {
          assignedSatellite = healthySatellites[Math.floor(Math.random() * healthySatellites.length)].id;
          pendingTasks.get(taskId)!.assignedSatellite = assignedSatellite;
        }
      }

      const response: TaskResponse = {
        taskId,
        modelId: submission.modelId,
        priority: submission.priority,
        status: 'queued',
        assignedSatellite,
        createdAt,
        estimatedCompletionTime: createdAt + (submission.timeout || 30000),
      };

      logger.info(
        {
          taskId,
          modelId: submission.modelId,
          priority: submission.priority,
          assignedSatellite,
          requestId: req.context.requestId,
        },
        'Inference task submitted'
      );

      res.status(202).json(response);
    } catch (error) {
      logger.error({ error, requestId: req.context.requestId }, 'Failed to submit task');
      res.status(500).json({ error: 'Failed to submit task' });
    }
  });

  // GET /api/v1/tasks/:id - Get task status
  router.get('/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const task = pendingTasks.get(id);

      if (!task) {
        return res.status(404).json({ error: 'Task not found', taskId: id });
      }

      const elapsedTime = Date.now() - task.createdAt;
      let status = 'queued';
      if (elapsedTime > 5000) {
        status = 'processing';
      }
      if (elapsedTime > 15000) {
        status = 'completed';
      }

      res.json({
        taskId: id,
        modelId: task.submission.modelId,
        priority: task.submission.priority,
        status,
        assignedSatellite: task.assignedSatellite,
        progress: Math.min(100, (elapsedTime / (task.submission.timeout || 30000)) * 100),
        createdAt: task.createdAt,
        updatedAt: Date.now(),
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error({ error, requestId: req.context.requestId }, 'Failed to get task status');
      res.status(500).json({ error: 'Failed to get task status' });
    }
  });

  // DELETE /api/v1/tasks/:id - Cancel task
  router.delete('/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const task = pendingTasks.get(id);

      if (!task) {
        return res.status(404).json({ error: 'Task not found', taskId: id });
      }

      pendingTasks.delete(id);

      logger.info({ taskId: id, requestId: req.context.requestId }, 'Task cancelled');

      res.json({
        status: 'cancelled',
        taskId: id,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error({ error, requestId: req.context.requestId }, 'Failed to cancel task');
      res.status(500).json({ error: 'Failed to cancel task' });
    }
  });

  // GET /api/v1/tasks - List all tasks
  router.get('/', (req: Request, res: Response) => {
    try {
      const tasks = Array.from(pendingTasks.entries()).map(([taskId, task]) => ({
        taskId,
        modelId: task.submission.modelId,
        priority: task.submission.priority,
        assignedSatellite: task.assignedSatellite,
        createdAt: task.createdAt,
        ageMs: Date.now() - task.createdAt,
      }));

      res.json({
        total: tasks.length,
        queued: tasks.filter(t => Date.now() - t.createdAt < 5000).length,
        processing: tasks.filter(t => Date.now() - t.createdAt >= 5000 && Date.now() - t.createdAt < 15000).length,
        tasks,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error({ error, requestId: req.context.requestId }, 'Failed to list tasks');
      res.status(500).json({ error: 'Failed to list tasks' });
    }
  });

  return router;
}
