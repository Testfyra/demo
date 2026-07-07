const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = process.cwd();

function normalizePath(filePath) {
  return filePath.split(path.sep).join('/');
}

function runNodeScript(scriptPath, args) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `Script failed: ${scriptPath}`);
  }

  return JSON.parse(result.stdout);
}

function main() {
  const failurePath = process.argv[2];
  const manifestPath =
    process.argv[3] || '.ai-orchestrator/chunks/manifest.jsonl';
  const chunkLimit = process.argv[4] || '8';

  if (!failurePath) {
    throw new Error(
      'Usage: node assemble-remediation-context.js <failure-json-path> [manifest-path] [chunk-limit]',
    );
  }

  const resolvedFailurePath = path.resolve(repoRoot, failurePath);
  const failure = JSON.parse(fs.readFileSync(resolvedFailurePath, 'utf8'));
  const retrieveScript = path.join(
    repoRoot,
    '.github',
    'workflows',
    'scripts',
    'retrieve-relevant-chunks.js',
  );

  const retrieval = runNodeScript(retrieveScript, [
    manifestPath,
    failure.raw_excerpt || failure.primary_message || '',
    (failure.file_paths || []).join(','),
    chunkLimit,
    failure.package || '',
    failure.check_name || '',
  ]);

  const context = {
    execution_id: failure.execution_id,
    check_name: failure.check_name,
    category: failure.category,
    package: failure.package,
    primary_message: failure.primary_message,
    command: failure.command,
    cwd: failure.cwd,
    file_paths: failure.file_paths,
    retrieved_chunk_count: retrieval.selected_chunks.length,
    retrieved_chunks: retrieval.selected_chunks,
    remediation_prompt: [
      `Failure category: ${failure.category}`,
      `Check: ${failure.check_name}`,
      `Command: ${failure.command}`,
      `Working directory: ${failure.cwd}`,
      `Primary error: ${failure.primary_message}`,
      'Relevant files:',
      ...(failure.file_paths || []).map((filePath) => `- ${filePath}`),
      'Use the retrieved chunks to identify the root cause and propose the smallest safe fix.',
    ].join('\n'),
  };

  const outputPath = path.join(
    repoRoot,
    '.ai-orchestrator',
    'contexts',
    `${failure.execution_id}.json`,
  );
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(context, null, 2));

  console.log(
    JSON.stringify(
      {
        ok: true,
        context_path: normalizePath(path.relative(repoRoot, outputPath)),
        retrieved_chunk_count: context.retrieved_chunk_count,
      },
      null,
      2,
    ),
  );
}

main();
