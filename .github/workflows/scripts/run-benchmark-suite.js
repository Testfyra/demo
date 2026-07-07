const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = process.cwd();

function normalizePath(filePath) {
  return filePath.split(path.sep).join('/');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function runNodeJson(scriptPath, args) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `Failed running ${scriptPath}`);
  }

  return JSON.parse(result.stdout);
}

function main() {
  const benchmarkPath =
    process.argv[2] ||
    path.join(repoRoot, '.ai-orchestrator', 'benchmarks', 'common-build-failures.json');
  const manifestPath =
    process.argv[3] ||
    path.join(repoRoot, '.ai-orchestrator', 'chunks', 'manifest.jsonl');
  const limit = process.argv[4] || '5';

  const benchmarks = readJson(benchmarkPath);
  const retrieveScript = path.join(
    repoRoot,
    '.github',
    'workflows',
    'scripts',
    'retrieve-relevant-chunks.js',
  );

  const results = [];

  for (const scenario of benchmarks) {
    const retrieval = runNodeJson(retrieveScript, [
      manifestPath,
      scenario.error_text,
      (scenario.changed_files || []).join(','),
      limit,
      scenario.package || '',
      scenario.check_name || '',
    ]);

    const returnedPaths = retrieval.selected_chunks.map((chunk) => chunk.path);
    const expectedHits = (scenario.expected_paths || []).filter((expectedPath) =>
      returnedPaths.includes(expectedPath),
    );

    results.push({
      id: scenario.id,
      category: scenario.category,
      expected_count: (scenario.expected_paths || []).length,
      hit_count: expectedHits.length,
      passed: expectedHits.length > 0,
      expected_paths: scenario.expected_paths || [],
      returned_paths: returnedPaths,
    });
  }

  const passed = results.filter((result) => result.passed).length;
  const summary = {
    ok: true,
    scenarios: results.length,
    passed,
    failed: results.length - passed,
    pass_rate: Number(((passed / results.length) * 100).toFixed(2)),
    results,
  };

  const outputPath = path.join(
    repoRoot,
    '.ai-orchestrator',
    'benchmarks',
    'benchmark-results.json',
  );
  fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2));

  console.log(
    JSON.stringify(
      {
        ok: true,
        scenarios: summary.scenarios,
        passed: summary.passed,
        failed: summary.failed,
        pass_rate: summary.pass_rate,
        output_path: normalizePath(path.relative(repoRoot, outputPath)),
      },
      null,
      2,
    ),
  );
}

main();
