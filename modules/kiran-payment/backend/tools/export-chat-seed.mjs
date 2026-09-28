// Writes the chat server's two generated files from the console's TypeScript:
//
//   backend/chat_seed.json      the demo workspace every client starts from
//   backend/chat_protocol.json  which operations exist, and which are private
//
// Both are authored once, in master-frontend/vd/src/lib, and compiled here so
// the server and the clients cannot drift apart.
//
//   node backend/tools/export-chat-seed.mjs     (from modules/kiran-payment)
//
// Paths are resolved from this file, so it runs from any directory.

import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const backend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workspace = path.resolve(backend, '..');
const lib = path.join(workspace, 'master-frontend', 'vd', 'src', 'lib');

// esbuild is hoisted to the npm workspace root.
const require = createRequire(path.join(workspace, 'package.json'));
const esbuild = require('esbuild');

async function load(entry) {
  const bundle = path.join(backend, `.${path.basename(entry, '.ts')}-bundle.mjs`);
  await esbuild.build({
    entryPoints: [path.join(lib, entry)],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile: bundle,
    logLevel: 'error',
  });
  try {
    return await import(pathToFileURL(bundle).href);
  } finally {
    fs.rmSync(bundle, { force: true });
  }
}

const seed = await load('chat-seed.ts');
const ops = await load('chat-ops.ts');

// The seed's timestamps are relative to the moment it is loaded. Recording
// that moment lets the server shift them to its own first start, so the demo
// workspace reads as recent rather than as the day this file was generated.
const chatSeed = {
  exportedAt: Date.now(),
  users: seed.SEED_USERS,
  groups: seed.SEED_GROUPS,
  rooms: seed.SEED_ROOMS,
  messages: seed.SEED_MESSAGES,
};

const protocol = {
  opTypes: ops.OP_TYPES,
  privateOpTypes: ops.PRIVATE_OP_TYPES,
  roomScopedOpTypes: ops.ROOM_SCOPED_OP_TYPES,
};

const write = (name, value) =>
  fs.writeFileSync(path.join(backend, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');

write('chat_seed.json', chatSeed);
write('chat_protocol.json', protocol);

console.log(
  `chat_seed.json — ${chatSeed.users.length} people, ${chatSeed.rooms.length} rooms, ` +
    `${chatSeed.messages.length} messages`,
);
console.log(
  `chat_protocol.json — ${protocol.opTypes.length} operations, ` +
    `${protocol.privateOpTypes.length} private`,
);
