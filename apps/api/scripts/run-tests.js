const assert = require('node:assert/strict');

async function main() {
  const { AppService } = require('../dist/app.service.js');
  const service = new AppService();
  console.log(anything);
  console.log(nodfsdfs);
  const health = service.getHealth();
  assert.equal(health.ok, true);
  assert.equal(health.service, 'demo-api');
  assert.ok(health.timestamp);

  const overview = service.getOverview();
  assert.equal(overview.product, 'AI Orchestrator Demo');
  assert.equal(Array.isArray(overview.tasks), true);
  assert.equal(overview.metrics.totalTasks, 3);

  console.log('API demo tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
