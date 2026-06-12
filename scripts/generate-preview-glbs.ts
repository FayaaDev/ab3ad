import fs from 'node:fs/promises';
import path from 'node:path';
import { generatePreviewGlb, getPreviewFilename, summarizePreview } from '@/lib/preview-glb';

const DEFAULT_SAMPLE_MODELS = [
  'abady.glb',
  'Abdo-Ab3ad3d.glb',
  'daeed.glb',
  'dabbrini.glb',
  'Mageed.glb',
  'MajidAbdullah.glb',
  'Sager-Ab3ad3d.glb',
  'SalimHilal.glb',
  'Talal-Ab3ad3d.glb',
];

function formatBytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

function getArgValue(name: string) {
  const inline = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (inline) {
    return inline.slice(name.length + 1);
  }
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main() {
  const sourceDir = path.resolve(process.cwd(), getArgValue('--source-dir') ?? 'assets');
  const outputDir = path.resolve(process.cwd(), getArgValue('--output-dir') ?? 'data/storage/samples');
  const namesArg = getArgValue('--models');
  const modelNames = namesArg ? namesArg.split(',').map((name) => name.trim()).filter(Boolean) : DEFAULT_SAMPLE_MODELS;

  await fs.mkdir(outputDir, { recursive: true });

  const summaries = [] as Array<{ name: string; sourceBytes: number; previewBytes: number; reductionRatio: number; outputPath: string }>;
  for (const modelName of modelNames) {
    const sourcePath = path.join(sourceDir, modelName);
    const outputPath = path.join(outputDir, getPreviewFilename(modelName));
    const source = await fs.readFile(sourcePath);
    const preview = await generatePreviewGlb(source);
    await fs.writeFile(outputPath, preview);

    const summary = { name: modelName, outputPath, ...summarizePreview(source.byteLength, preview.byteLength) };
    summaries.push(summary);
    console.log(`${modelName}: ${formatBytes(summary.sourceBytes)} → ${formatBytes(summary.previewBytes)} (${(summary.reductionRatio * 100).toFixed(1)}%)`);
  }

  const oversized = summaries.filter((summary) => summary.previewBytes >= summary.sourceBytes);
  if (oversized.length) {
    throw new Error(`Preview generation did not reduce size for: ${oversized.map((summary) => summary.name).join(', ')}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
