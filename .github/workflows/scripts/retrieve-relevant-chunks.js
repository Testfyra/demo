const fs = require('fs');
const path = require('path');

const repoRoot = process.cwd();
const manifestPath = path.resolve(
  process.argv[2] ||
    path.join(repoRoot, '.ai-orchestrator', 'chunks', 'manifest.jsonl'),
);
const errorInput = process.argv[3] || '';
const changedFilesInput = process.argv[4] || '';
const limit = Number(process.argv[5] || 8);

function normalizePath(filePath) {
  return filePath.split(path.sep).join('/');
}

function loadManifest(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function parseChangedFiles(input) {
  return input
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map(normalizePath);
}

function extractFilePaths(text) {
  const matches = new Set();
  const normalizedText = String(text || '');
  const patterns = [
    /(?:^|[\s("'`])((?:apps|\.github|postman)\/[A-Za-z0-9._/\-]+?\.[A-Za-z0-9]+)(?=$|[\s)"'`:,])/g,
    /(?:^|[\s("'`])((?:README|\.orchestrator)[A-Za-z0-9._/\-]*)(?=$|[\s)"'`:,])/g,
  ];

  for (const pattern of patterns) {
    for (const match of normalizedText.matchAll(pattern)) {
      matches.add(normalizePath(match[1]));
    }
  }

  return [...matches];
}

function inferPackage(text) {
  if (/apps\/web|vite|react|tsx?|frontend/i.test(text)) {
    return 'apps/web';
  }

  if (/apps\/api|nestjs|node|backend|unit_tests|api_/i.test(text)) {
    return 'apps/api';
  }

  if (/workflow|github actions|orchestrator|\.github|yaml/i.test(text)) {
    return '.github';
  }

  return null;
}

function scoreChunk(chunk, context) {
  let score = 0;
  const haystack = `${chunk.path}\n${chunk.text}\n${chunk.symbol_names.join(' ')}\n${chunk.imports.join(' ')}`.toLowerCase();

  if (context.directPaths.has(chunk.path)) {
    score += 120;
  }

  if (context.changedFiles.has(chunk.path)) {
    score += 90;
  }

  if (context.targetPackage && chunk.package === context.targetPackage) {
    score += 25;
  }

  if (context.directPaths.size > 0) {
    for (const directPath of context.directPaths) {
      if (chunk.path.startsWith(path.posix.dirname(directPath))) {
        score += 12;
      }
    }
  }

  for (const term of context.keyTerms) {
    if (haystack.includes(term)) {
      score += 4;
    }
  }

  if (
    context.errorText &&
    /npm test|unit test|assert|jest|mocha/i.test(context.errorText) &&
    /test|assert|run-tests/.test(chunk.path)
  ) {
    score += 15;
  }

  if (
    context.errorText &&
    /npm run build|tsc|typescript|vite/i.test(context.errorText) &&
    /src\/|tsconfig|vite/.test(chunk.path)
  ) {
    score += 15;
  }

  return score;
}

function buildKeyTerms(text) {
  return [...new Set(
    String(text || '')
      .toLowerCase()
      .split(/[^a-z0-9._/-]+/)
      .map((term) => term.trim())
      .filter((term) => term.length >= 4)
      .slice(0, 40),
  )];
}

function main() {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      `Chunk manifest not found at ${normalizePath(path.relative(repoRoot, manifestPath))}`,
    );
  }

  const chunks = loadManifest(manifestPath);
  const changedFiles = new Set(parseChangedFiles(changedFilesInput));
  const directPaths = new Set([
    ...extractFilePaths(errorInput),
    ...changedFiles,
  ]);
  const targetPackage = inferPackage(errorInput);
  const keyTerms = buildKeyTerms(errorInput);

  const scored = chunks
    .map((chunk) => ({
      score: scoreChunk(chunk, {
        changedFiles,
        directPaths,
        targetPackage,
        keyTerms,
        errorText: errorInput,
      }),
      chunk,
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);

  const result = {
    ok: true,
    manifest: normalizePath(path.relative(repoRoot, manifestPath)),
    target_package: targetPackage,
    direct_paths: [...directPaths],
    changed_files: [...changedFiles],
    selected_chunks: scored.map(({ score, chunk }) => ({
      score,
      chunk_id: chunk.chunk_id,
      path: chunk.path,
      start_line: chunk.start_line,
      end_line: chunk.end_line,
      package: chunk.package,
      symbol_names: chunk.symbol_names,
      token_estimate: chunk.token_estimate,
      text: chunk.text,
    })),
  };

  console.log(JSON.stringify(result, null, 2));
}

main();
