// Regenerates backend/seed.json from the frontend's src/data/mock.ts.
//
// The demo data is authored once, in the frontend, and compiled into the seed
// the API boots from — so the two can never drift.
//
//   cd frontend && node ../backend/tools/regenerate-seed.mjs
//
// Must be run from the frontend directory, so `esbuild` resolves from its
// node_modules.

import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const frontend = process.cwd();
if (!fs.existsSync(path.join(frontend, 'src/data/mock.ts'))) {
  console.error('Run this from the frontend directory:');
  console.error('  cd frontend && node ../backend/tools/regenerate-seed.mjs');
  process.exit(1);
}

// Node resolves bare imports from this script's own directory, so reach into
// the frontend's node_modules explicitly rather than requiring a copy here.
const require = createRequire(path.join(frontend, 'package.json'));
const esbuild = require('esbuild');

const bundle = path.join(frontend, '.seed-bundle.mjs');

await esbuild.build({
  entryPoints: [path.join(frontend, 'src/data/mock.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: bundle,
  alias: { '@': path.join(frontend, 'src') },
  logLevel: 'error',
});

const mock = await import(pathToFileURL(bundle).href);

const seed = {
  currentEmployeeId: mock.CURRENT_EMPLOYEE_ID,
  employees: mock.employees,
  requests: mock.requests,
  payouts: mock.payouts,
  notifications: mock.notifications,
  monthlySpend: mock.monthlySpend,
  departmentUtilisation: mock.departmentUtilisation,
  policyCaps: mock.policyCaps,
};

const target = path.join(frontend, '..', 'backend', 'seed.json');
fs.writeFileSync(target, JSON.stringify(seed, null, 2), 'utf8');
fs.rmSync(bundle, { force: true });

console.log(
  `seed.json written — ${seed.employees.length} employees, ` +
    `${seed.requests.length} requests, ${seed.payouts.length} payouts, ` +
    `${seed.notifications.length} notifications`,
);
console.log('Restart the API, then POST /api/demo/reset to load it.');
