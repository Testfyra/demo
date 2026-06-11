const fs = require('fs');
const { execSync } = require('child_process');

function loadYamlModule() {
  try {
    return require('js-yaml');
  } catch (_) {
    return require('../../../apps/api/node_modules/js-yaml');
  }
}

const yaml = loadYamlModule();

const recommendedChecks =
  process.argv[2]?.split(',').map((c) => c.trim()) || [];
const configPath = process.argv[3] || '.orchestrator.yml';

console.log('Recommended checks:', recommendedChecks);

const config = yaml.load(
  fs.readFileSync(configPath, 'utf8'),
);

for (const check of recommendedChecks) {
  const definition = config.checks?.[check];

  if (!definition) {
    console.log(`Skipping unknown check: ${check}`);
    continue;
  }

  const workingDirectory =
    definition.workingDirectory ||
    config.project?.defaultWorkingDirectory ||
    '.';

  console.log(`Running check: ${check}`);
  console.log(`Working directory: ${workingDirectory}`);

  for (const command of definition.commands || []) {
    console.log(`Executing: ${command}`);

    execSync(command, {
      cwd: workingDirectory,
      stdio: 'inherit',
    });
  }
}

console.log('All orchestrator checks completed.');
