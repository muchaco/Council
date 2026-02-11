#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const coverageSummaryPath = path.resolve(process.cwd(), 'coverage', 'coverage-summary.json');

const CORE_LINES_THRESHOLD = Number(process.env.CORE_LINES_THRESHOLD ?? 80);
const CORE_BRANCHES_THRESHOLD = Number(process.env.CORE_BRANCHES_THRESHOLD ?? 70);
const SHELL_LINES_THRESHOLD = Number(process.env.SHELL_LINES_THRESHOLD ?? 40);

const ENFORCE_SHELL = process.argv.includes('--enforce-shell');

const toPosix = (value) => value.replaceAll('\\', '/');

const normalizeCoveragePath = (value, repositoryRoot) => {
  const normalized = toPosix(value);

  if (path.isAbsolute(value)) {
    return toPosix(path.relative(repositoryRoot, value));
  }

  const cwdRelative = toPosix(path.relative(repositoryRoot, path.resolve(process.cwd(), value)));
  if (!cwdRelative.startsWith('..')) {
    return cwdRelative;
  }

  return normalized;
};

const layerForFile = (relativeFilePath) => {
  if (relativeFilePath.startsWith('lib/core/')) {
    return 'core';
  }

  if (
    relativeFilePath.startsWith('stores/') ||
    relativeFilePath.startsWith('electron/') ||
    relativeFilePath.startsWith('lib/shell/')
  ) {
    return 'shell';
  }

  if (relativeFilePath.startsWith('lib/application/')) {
    return 'application';
  }

  if (relativeFilePath.startsWith('lib/infrastructure/')) {
    return 'infrastructure';
  }

  return 'other';
};

const createMetricBucket = () => ({ total: 0, covered: 0 });

const createLayerBucket = () => ({
  lines: createMetricBucket(),
  branches: createMetricBucket(),
  statements: createMetricBucket(),
  functions: createMetricBucket(),
  files: 0,
});

const layers = {
  core: createLayerBucket(),
  application: createLayerBucket(),
  infrastructure: createLayerBucket(),
  shell: createLayerBucket(),
  other: createLayerBucket(),
};

const mergeMetric = (target, source) => {
  target.total += source.total;
  target.covered += source.covered;
};

const toPercent = (metric) => {
  if (metric.total === 0) {
    return 0;
  }

  return (metric.covered / metric.total) * 100;
};

if (!fs.existsSync(coverageSummaryPath)) {
  console.error(`Coverage summary not found at ${coverageSummaryPath}`);
  console.error('Run `npm run test:coverage` before running the layer coverage gate.');
  process.exit(1);
}

const summary = JSON.parse(fs.readFileSync(coverageSummaryPath, 'utf8'));
const repositoryRoot = process.cwd();

for (const [filePath, fileCoverage] of Object.entries(summary)) {
  if (filePath === 'total') {
    continue;
  }

  const relativeFilePath = normalizeCoveragePath(filePath, repositoryRoot);
  if (relativeFilePath.endsWith('.test.ts') || relativeFilePath.endsWith('.test.tsx')) {
    continue;
  }

  const layer = layerForFile(relativeFilePath);
  const bucket = layers[layer];
  bucket.files += 1;
  mergeMetric(bucket.lines, fileCoverage.lines);
  mergeMetric(bucket.branches, fileCoverage.branches);
  mergeMetric(bucket.statements, fileCoverage.statements);
  mergeMetric(bucket.functions, fileCoverage.functions);
}

const formatPct = (value) => `${value.toFixed(1)}%`;

console.log('Layer coverage snapshot');
for (const layerName of ['core', 'application', 'infrastructure', 'shell', 'other']) {
  const layer = layers[layerName];
  console.log(
    `- ${layerName}: files=${layer.files}, lines=${formatPct(toPercent(layer.lines))}, branches=${formatPct(toPercent(layer.branches))}`
  );
}

const coreLinesPct = toPercent(layers.core.lines);
const coreBranchesPct = toPercent(layers.core.branches);
const shellLinesPct = toPercent(layers.shell.lines);

const failures = [];

if (layers.core.files === 0) {
  failures.push('No core files were found in coverage output (lib/core/**).');
}

if (coreLinesPct < CORE_LINES_THRESHOLD) {
  failures.push(
    `Core line coverage ${formatPct(coreLinesPct)} is below threshold ${CORE_LINES_THRESHOLD}%`
  );
}

if (coreBranchesPct < CORE_BRANCHES_THRESHOLD) {
  failures.push(
    `Core branch coverage ${formatPct(coreBranchesPct)} is below threshold ${CORE_BRANCHES_THRESHOLD}%`
  );
}

if (ENFORCE_SHELL && shellLinesPct < SHELL_LINES_THRESHOLD) {
  failures.push(
    `Shell line coverage ${formatPct(shellLinesPct)} is below threshold ${SHELL_LINES_THRESHOLD}%`
  );
}

if (!ENFORCE_SHELL && shellLinesPct < SHELL_LINES_THRESHOLD) {
  console.warn(
    `Shell line coverage ${formatPct(shellLinesPct)} is below advisory threshold ${SHELL_LINES_THRESHOLD}%`
  );
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`FAIL: ${failure}`);
  }
  process.exit(1);
}

console.log('Coverage quality gate passed.');
