const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BASELINE_CHECKS = [
  'api_build_validation',
  'api_unit_tests',
  'web_build_validation',
];

const CHECK_ALIASES = {
  integration_tests: 'api_unit_tests',
};

function parseScalar(value) {
  const trimmed = String(value || '').trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function parseOrchestratorConfig(source) {
  const config = {
    project: {},
    checks: {},
  };

  const lines = String(source)
    .replace(/\r/g, '')
    .split('\n');

  let section = null;
  let currentCheck = null;
  let collectingCommands = false;

  for (const rawLine of lines) {
    const indent = rawLine.match(/^ */)?.[0]?.length || 0;
    const trimmed = rawLine.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    if (indent === 0 && trimmed.endsWith(':')) {
      section = trimmed.slice(0, -1);
      currentCheck = null;
      collectingCommands = false;
      continue;
    }

    if (section === 'project' && indent === 2) {
      const separatorIndex = trimmed.indexOf(':');
      if (separatorIndex === -1) {
        continue;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim();
      config.project[key] = parseScalar(value);
      continue;
    }

    if (section === 'checks' && indent === 2 && trimmed.endsWith(':')) {
      currentCheck = trimmed.slice(0, -1);
      collectingCommands = false;
      config.checks[currentCheck] = {
        commands: [],
      };
      continue;
    }

    if (!currentCheck) {
      continue;
    }

    if (indent === 4 && trimmed === 'commands:') {
      collectingCommands = true;
      continue;
    }

    if (indent === 4) {
      const separatorIndex = trimmed.indexOf(':');
      if (separatorIndex === -1) {
        continue;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim();
      config.checks[currentCheck][key] = parseScalar(value);
      collectingCommands = false;
      continue;
    }

    if (collectingCommands && indent >= 6 && trimmed.startsWith('- ')) {
      config.checks[currentCheck].commands.push(
        parseScalar(trimmed.slice(2)),
      );
    }
  }

  return config;
}

const recommendedChecks = (process.argv[2] || '')
  .split(',')
  .map((c) => c.trim())
  .filter(Boolean);
const configPath = process.argv[3] || '.orchestrator.yml';
const resolvedConfigPath = path.resolve(configPath);
const configDirectory = path.dirname(resolvedConfigPath);

const config = parseOrchestratorConfig(
  fs.readFileSync(resolvedConfigPath, 'utf8'),
);

const checksToRun = [...new Set([...BASELINE_CHECKS, ...recommendedChecks])];

console.log('Baseline checks:', BASELINE_CHECKS);
console.log('Recommended checks:', recommendedChecks);
console.log('Final checks to run:', checksToRun);

for (const check of checksToRun) {
  const resolvedCheck = config.checks?.[check]
    ? check
    : CHECK_ALIASES[check];
  const definition = config.checks?.[resolvedCheck];

  if (!definition) {
    throw new Error(`Unknown check in execution set: ${check}`);
  }

  if (resolvedCheck !== check) {
    console.log(`Resolved check alias: ${check} -> ${resolvedCheck}`);
  }

  const workingDirectory = path.resolve(
    configDirectory,
    definition.workingDirectory ||
      config.project?.defaultWorkingDirectory ||
      '.',
  );

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
