# AI Orchestrator Demo Repo

This is now a small demo full-stack application with:

- a React frontend in `apps/web`
- a NestJS API in `apps/api`

The existing repo-level orchestrator and workflow configuration is left in place.

Scenarios you can simulate:

- passing build validation
- failing TypeScript build
- failing tests
- dependency scan issues
- manual review required
- blocked execution

Suggested flow:

1. create a GitHub repo from this directory
2. push it to GitHub
3. install your GitHub App on that repo
4. raise PRs that intentionally break or fix code
5. watch the orchestrator dashboard update with real execution data

## Local app structure

- `apps/api`
  - `GET /health`
  - `GET /api/overview`
- `apps/web`
  - React dashboard that fetches `http://localhost:3001/api/overview`

## Run locally

API:

```bash
cd apps/api
npm install
npm run start:dev
```

Web:

```bash
cd apps/web
npm install
npm run dev
```
