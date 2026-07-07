const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const repoRoot = process.cwd();
const outputDir = path.join(repoRoot, '.ai-orchestrator', 'chunks');
const manifestPath = path.join(outputDir, 'manifest.jsonl');
const summaryPath = path.join(outputDir, 'summary.json');

const IGNORED_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.ai-orchestrator/chunks',
]);

const TEXT_EXTENSIONS = new Map([
  ['.js', 'javascript'],
  ['.cjs', 'javascript'],
  ['.mjs', 'javascript'],
  ['.ts', 'typescript'],
  ['.tsx', 'tsx'],
  ['.jsx', 'jsx'],
  ['.json', 'json'],
  ['.yml', 'yaml'],
  ['.yaml', 'yaml'],
  ['.md', 'markdown'],
  ['.css', 'css'],
  ['.html', 'html'],
  ['.txt', 'text'],
]);

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function normalizePath(filePath) {
  return filePath.split(path.sep).join('/');
}

function shouldIgnoreDir(relativePath) {
  if (!relativePath) {
    return false;
  }

  const normalized = normalizePath(relativePath);
  const segments = normalized.split('/');

  return [...IGNORED_DIRECTORIES].some((ignored) => {
    if (ignored.includes('/')) {
      return normalized === ignored || normalized.startsWith(`${ignored}/`);
    }

    return segments.includes(ignored);
  });
}

function walkFiles(dirPath, relativeBase = '') {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = relativeBase
      ? path.join(relativeBase, entry.name)
      : entry.name;

    if (entry.isDirectory()) {
      if (shouldIgnoreDir(relativePath)) {
        continue;
      }

      files.push(...walkFiles(path.join(dirPath, entry.name), relativePath));
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();
    if (!TEXT_EXTENSIONS.has(extension)) {
      continue;
    }

    files.push(path.join(dirPath, entry.name));
  }

  return files;
}

function estimateTokens(text) {
  return Math.ceil(String(text).length / 4);
}

function extractSymbols(lines, language) {
  const patterns = [
    /export\s+(?:class|function|const|type|interface)\s+([A-Za-z0-9_]+)/,
    /(?:class|function)\s+([A-Za-z0-9_]+)/,
    /const\s+([A-Za-z0-9_]+)\s*=/,
  ];

  const symbols = new Set();

  if (language === 'markdown' || language === 'text') {
    return [];
  }

  for (const line of lines) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        symbols.add(match[1]);
      }
    }
  }

  return [...symbols];
}

function extractImports(lines) {
  const imports = [];

  for (const line of lines) {
    const match = line.match(
      /(?:import\s+.*?\s+from\s+|require\()\s*['"]([^'"]+)['"]/,
    );

    if (match) {
      imports.push(match[1]);
    }
  }

  return [...new Set(imports)];
}

function classifyPackage(relativePath) {
  const normalized = normalizePath(relativePath);

  if (normalized.startsWith('apps/api/')) {
    return 'apps/api';
  }

  if (normalized.startsWith('apps/web/')) {
    return 'apps/web';
  }

  if (normalized.startsWith('.github/')) {
    return '.github';
  }

  return 'repo';
}

function buildChunkRecords(relativePath, content, language) {
  const lines = content.replace(/\r/g, '').split('\n');
  const normalizedPath = normalizePath(relativePath);
  const packageName = classifyPackage(normalizedPath);
  const totalLines = lines.length;
  const records = [];

  let blockSize = 220;
  let overlap = 40;

  if (language === 'json' || language === 'yaml' || language === 'markdown') {
    blockSize = 140;
    overlap = 20;
  }

  let chunkIndex = 0;
  let startLine = 1;

  while (startLine <= totalLines) {
    const endLine = Math.min(startLine + blockSize - 1, totalLines);
    const chunkLines = lines.slice(startLine - 1, endLine);
    const text = chunkLines.join('\n').trimEnd();

    if (!text.trim()) {
      startLine = endLine + 1;
      continue;
    }

    const hash = crypto
      .createHash('sha1')
      .update(`${normalizedPath}:${startLine}:${endLine}:${text}`)
      .digest('hex');

    records.push({
      chunk_id: `${normalizedPath}::chunk-${String(chunkIndex).padStart(3, '0')}`,
      repo: path.basename(repoRoot),
      path: normalizedPath,
      package: packageName,
      language,
      start_line: startLine,
      end_line: endLine,
      chunk_type: language,
      symbol_names: extractSymbols(chunkLines, language),
      imports: extractImports(chunkLines),
      token_estimate: estimateTokens(text),
      hash,
      text,
    });

    if (endLine === totalLines) {
      break;
    }

    startLine = Math.max(endLine - overlap + 1, startLine + 1);
    chunkIndex += 1;
  }

  return records;
}

function main() {
  ensureDirectory(outputDir);

  const files = walkFiles(repoRoot);
  const allRecords = [];
  let fileCount = 0;

  for (const absolutePath of files) {
    const relativePath = path.relative(repoRoot, absolutePath);
    const extension = path.extname(relativePath).toLowerCase();
    const language = TEXT_EXTENSIONS.get(extension);

    if (!language) {
      continue;
    }

    const content = fs.readFileSync(absolutePath, 'utf8');
    const records = buildChunkRecords(relativePath, content, language);

    allRecords.push(...records);
    fileCount += 1;
  }

  fs.writeFileSync(
    manifestPath,
    `${allRecords.map((record) => JSON.stringify(record)).join('\n')}\n`,
  );

  fs.writeFileSync(
    summaryPath,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        repo: path.basename(repoRoot),
        files_indexed: fileCount,
        chunks_indexed: allRecords.length,
        output: normalizePath(path.relative(repoRoot, manifestPath)),
      },
      null,
      2,
    ),
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        files_indexed: fileCount,
        chunks_indexed: allRecords.length,
        manifest: normalizePath(path.relative(repoRoot, manifestPath)),
      },
      null,
      2,
    ),
  );
}

main();
