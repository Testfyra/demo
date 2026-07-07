const fs = require('fs');
const path = require('path');

const repoRoot = process.cwd();

function normalizePath(filePath) {
  return filePath.split(path.sep).join('/');
}

function readExecutionLog(logPath) {
  const resolved = path.resolve(logPath);
  return JSON.parse(fs.readFileSync(resolved, 'utf8'));
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function extractFilePaths(text) {
  const matches = [];
  const patterns = [
    /((?:apps|\.github|postman)\/[A-Za-z0-9._/\-]+?\.[A-Za-z0-9]+)/g,
    /(README\.md|\.orchestrator\.yml)/g,
    /(src\/[A-Za-z0-9._/\-]+?\.[A-Za-z0-9]+)/g,
  ];

  for (const pattern of patterns) {
    for (const match of String(text || '').matchAll(pattern)) {
      matches.push(match[1]);
    }
  }

  return unique(matches.map(normalizePath));
}

function inferCategory(text) {
  const haystack = String(text || '').toLowerCase();

  if (/npm audit|vulnerab|ghsa-|severity:/i.test(haystack)) {
    return 'dependency_scan';
  }

  if (/ts\d{4}|typescript|tsc|vite build|syntaxerror|cannot find name|declaration or statement expected/i.test(haystack)) {
    return 'typescript_build_failure';
  }

  if (/assert|test(s)? passed|npm test|jest|mocha|expected .* to/i.test(haystack)) {
    return 'test_failure';
  }

  if (/module not found|cannot find module|failed to resolve import/i.test(haystack)) {
    return 'module_resolution_failure';
  }

  if (/yaml|workflow|github actions|unknown check|invalid workflow/i.test(haystack)) {
    return 'config_failure';
  }

  return 'generic_command_failure';
}

function extractPrimaryMessage(text) {
  const lines = String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const preferredPatterns = [
    /error/i,
    /failed/i,
    /exception/i,
    /cannot/i,
    /expected/i,
    /severity:/i,
  ];

  for (const pattern of preferredPatterns) {
    const line = lines.find((candidate) => pattern.test(candidate));
    if (line) {
      return line;
    }
  }

  return lines[0] || 'Command failed without a parseable message';
}

function inferPackage(log, filePaths) {
  const cwd = String(log.cwd || '');
  const joined = `${cwd}\n${filePaths.join('\n')}\n${log.command || ''}`;

  if (/apps\/web|web/.test(joined)) {
    return 'apps/web';
  }

  if (/apps\/api|api/.test(joined)) {
    return 'apps/api';
  }

  if (/\.github|workflow/.test(joined)) {
    return '.github';
  }

  return 'repo';
}

function inferRelatedPaths(log, category, pkg) {
  if (category === 'dependency_scan') {
    if (pkg === 'apps/api') {
      return ['apps/api/package.json', 'apps/api/package-lock.json'];
    }

    if (pkg === 'apps/web') {
      return ['apps/web/package.json', 'apps/web/package-lock.json'];
    }
  }

  return [];
}

function main() {
  const logPath = process.argv[2];

  if (!logPath) {
    throw new Error('Usage: node extract-failure-signature.js <log-json-path>');
  }

  const log = readExecutionLog(logPath);
  const combined = [log.stdout, log.stderr, log.combined_output].filter(Boolean).join('\n');
  const extractedPaths = extractFilePaths(combined);
  const inferredPackage = inferPackage(log, extractedPaths);
  const category = inferCategory(combined);
  const filePaths = unique([
    ...extractedPaths,
    ...inferRelatedPaths(log, category, inferredPackage),
  ]);
  const failure = {
    execution_id: log.execution_id,
    provider: log.provider,
    check_name: log.check_name,
    command: log.command,
    cwd: log.cwd,
    exit_code: log.exit_code,
    ok: log.ok,
    category,
    primary_message: extractPrimaryMessage(combined),
    file_paths: filePaths,
    package: inferredPackage,
    raw_excerpt: combined.split('\n').slice(0, 80).join('\n'),
    extracted_at: new Date().toISOString(),
  };

  const outputPath = path.join(
    repoRoot,
    '.ai-orchestrator',
    'failures',
    `${failure.execution_id}.json`,
  );
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(failure, null, 2));

  console.log(
    JSON.stringify(
      {
        ok: true,
        category: failure.category,
        primary_message: failure.primary_message,
        file_paths: failure.file_paths,
        output_path: normalizePath(path.relative(repoRoot, outputPath)),
      },
      null,
      2,
    ),
  );
}

main();
