# AI Orchestrator Demo Repo

This is a standalone dummy repository for generating real orchestration data.


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
