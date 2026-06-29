import { Injectable } from '@nestjs/common';

export type DemoTask = {
  id: number;
  title: string;
  status: 'planned' | 'in-progress' | 'done';
  owner: string;
};

@Injectable()
export class AppService {
  private readonly tasks: DemoTask[] = [
    { id: 1, title: 'Design landing screen', status: 'done', owner: 'Ava' },
    { id: 2, title: 'Build API endpoints', status: 'in-progress', owner: 'Kai' },
    { id: 3, title: 'Wire React dashboard', status: 'planned', owner: 'Mira' },
  ];

  getHealth() {
    return {
      ok: true,
      service: 'demo-api',
      timestamp: new Date().toISOString(),
    };
  }

  getOverview() {
    const doneCount = this.tasks.filter((task) => task.status === 'done').length;

    return {
      product: 'AI Orchestrator Demo',
      summary: 'A small full-stack workspace with a React frontend and NestJS API.',
      metrics: {
        totalTasks: this.tasks.length,
        completedTasks: doneCount,
        activeTasks: this.tasks.filter((task) => task.status === 'in-progress').length,
      },
      tasks: this.tasks,
    };
  }
}
