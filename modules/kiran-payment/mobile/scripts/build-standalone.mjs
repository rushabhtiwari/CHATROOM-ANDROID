#!/usr/bin/env node
/**
 * Build the web app for a standalone APK: no backend, keys baked in.
 *
 * Reads the backend's .env (the one file that already holds the keys), passes
 * the settings the in-app server needs to Vite as VITE_<NAME>, and builds with
 * VITE_STANDALONE=true. Nothing is written to disk but the build itself, and
 * only the names of the settings are printed.
 *
 *   node scripts/build-standalone.mjs      (then: npx cap sync android)
 *
 * Anything baked into an app can be read back out of it. Use this only for a
 * build its owner installs on their own phone.
 */
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const mobile = resolve(here, '..');
const envFile = resolve(mobile, '../backend/.env');

/** The backend settings the in-app server reads (see src/local/config.ts). */
const NAMES = [
  'OPENAI_API_KEY',
  'OPENAI_BASE_URL',
  'OPENAI_MODEL',
  'OPENAI_EXTRACTION_MODEL',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REFRESH_TOKEN',
  'GOOGLE_CALENDAR_REFRESH_TOKEN',
  'GOOGLE_MEET_REFRESH_TOKEN',
  'RTS_TIME_ZONE',
  'RTS_ENFORCE_BUDGET',
];

function parse(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!match || line.trimStart().startsWith('#')) continue;
    values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return values;
}

const settings = existsSync(envFile) ? parse(readFileSync(envFile, 'utf8')) : {};
const env = { ...process.env, VITE_STANDALONE: 'true', VITE_API_ORIGIN: '' };
const baked = [];
for (const name of NAMES) {
  if (settings[name]) {
    env[`VITE_${name}`] = settings[name];
    baked.push(name);
  }
}
console.log(`Standalone build. Baked in: ${baked.join(', ') || 'nothing (no backend/.env)'}`);

const run = (command) => {
  const result = spawnSync(command, { cwd: mobile, env, stdio: 'inherit', shell: true });
  if (result.status !== 0) process.exit(result.status ?? 1);
};
run('npx tsc');
run('npx vite build');
