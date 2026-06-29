import { useEffect, useState } from 'react';

type Overview = {
  product: string;
  summary: string;
  metrics: {
    totalTasks: number;
    completedTasks: number;
    activeTasks: number;
  };
  tasks: Array<{
    id: number;
    title: string;
    status: 'planned' | 'in-progress' | 'done';
    owner: string;
  }>;
};

const API_BASE_URL = 'http://localhost:3001';

export function App() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadOverview() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/overview`);
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const data = (await response.json()) as Overview;
        setOverview(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    void loadOverview();
  }, []);

  return (
    <main className="page-shell">
      <section className="hero-card">
        <p className="eyebrow">Demo Full-Stack Workspace</p>
        <h1>{overview?.product ?? 'AI Orchestrator Demo'}</h1>
        <p className="hero-copy">
          {overview?.summary ??
            'A React dashboard backed by a NestJS API for showing demo orchestration state.'}
        </p>
        <div className="hero-meta">
          <span>Frontend: React + Vite</span>
          <span>Backend: NestJS</span>
          <span>API Base: {API_BASE_URL}</span>
        </div>
      </section>

      <section className="grid">
        <article className="panel">
          <h2>Overview</h2>
          {loading && <p>Loading API data...</p>}
          {error && <p className="error-text">Unable to load overview: {error}</p>}
          {overview && (
            <div className="stats">
              <div className="stat">
                <strong>{overview.metrics.totalTasks}</strong>
                <span>Total tasks</span>
              </div>
              <div className="stat">
                <strong>{overview.metrics.completedTasks}</strong>
                <span>Completed</span>
              </div>
              <div className="stat">
                <strong>{overview.metrics.activeTasks}</strong>
                <span>In progress</span>
              </div>
            </div>
          )}
        </article>

        <article className="panel">
          <h2>API Routes</h2>
          <ul className="route-list">
            <li>
              <code>GET /health</code>
            </li>
            <li>
              <code>GET /api/overview</code>
            </li>
          </ul>
        </article>
      </section>

      <section className="panel">
        <h2>Task Board</h2>
        <div className="task-list">
          {overview?.tasks.map((task) => (
            <article className="task-card" key={task.id}>
              <div className="task-header">
                <h3>{task.title}</h3>
                <span className={`status-pill status-${task.status}`}>{task.status}</span>
              </div>
              <p>Owner: {task.owner}</p>
            </article>
          ))}
          {!loading && !overview && !error && <p>No tasks returned by the API.</p>}
        </div>
      </section>
    </main>
  );
}
