import fs from 'node:fs';
import path from 'node:path';

function parseEnvValue(value: string) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function loadLocalEnv() {
  for (const fileName of ['.env.local', '.env']) {
    const filePath = path.join(process.cwd(), fileName);
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex === -1) {
        continue;
      }
      const key = trimmed.slice(0, separatorIndex).trim();
      const value = parseEnvValue(trimmed.slice(separatorIndex + 1));
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

function hasNonEmptyEnvValue(name: string) {
  return Boolean(process.env[name]);
}

export function getScriptEnvPresence(names: readonly string[]) {
  return Object.fromEntries(names.map((name) => [name, hasNonEmptyEnvValue(name)]));
}

export function assertRequiredScriptEnv(scriptName: string, names: readonly string[]) {
  const missing = names.filter((name) => !hasNonEmptyEnvValue(name));
  if (!missing.length) {
    return;
  }

  throw new Error(
    `${scriptName} requires non-empty ${missing.join(', ')}. Check exported env vars and .env/.env.local.`,
  );
}
