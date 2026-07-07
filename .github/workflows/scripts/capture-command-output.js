const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = process.cwd();
const outputDir = path.join(repoRoot, '.ai-orchestrator', 'logs');

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function normalizePath(filePath) {
  return filePath.split(path.sep).join('/');
}

function readArg(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) {
    return fallback;
  }

  return process.argv[index + 1] || fallback;
}

function main() {
  const command = readArg('command');
  const workingDirectory = readArg('cwd', '.');
  const executionId =
    readArg('execution-id') || `local-${Date.now()}`;
  const checkName = readArg('check-name', 'manual_check');
  const provider = readArg('provider', 'local');

  if (!command) {
    throw new Error('Missing required --command argument');
  }

  ensureDirectory(outputDir);

  const cwd = path.resolve(repoRoot, workingDirectory);
  const startedAt = new Date();
  const result = spawnSync(command, {
    cwd,
    shell: true,
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 10 * 1024 * 1024,
  });
  const completedAt = new Date();

  const payload = {
    execution_id: executionId,
    check_name: checkName,
    provider,
    command,
    cwd: normalizePath(path.relative(repoRoot, cwd) || '.'),
    started_at: startedAt.toISOString(),
    completed_at: completedAt.toISOString(),
    duration_ms: completedAt.getTime() - startedAt.getTime(),
    exit_code: typeof result.status === 'number' ? result.status : 1,
    signal: result.signal || null,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    combined_output: `${result.stdout || ''}${result.stderr ? `\n${result.stderr}` : ''}`.trim(),
    ok: result.status === 0,
  };

  const outputPath = path.join(outputDir, `${executionId}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));

  console.log(
    JSON.stringify(
      {
        ok: payload.ok,
        exit_code: payload.exit_code,
        log_path: normalizePath(path.relative(repoRoot, outputPath)),
      },
      null,
      2,
    ),
  );

  if (result.error) {
    throw result.error;
  }

  process.exit(payload.exit_code);
}

main();
