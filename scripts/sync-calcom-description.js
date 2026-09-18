#!/usr/bin/env node
// Pushes the build-time-generated Cal.com description (dist/api/calcom-event-description.json,
// itself derived from src/data/pricing.ts + src/data/products.ts) into Cal.com's own
// Postgres DB, so the "daintytrading" booking page description never has to be hand-edited
// to match the site's real pricing/product count.
//
// Writes directly to Postgres instead of Cal.com's REST API: this self-hosted instance's
// /api/v2/* proxies to a separate NestJS service (localhost:5555) that isn't deployed here,
// and legacy /api/v1 is gone (404) in this Cal.com version. Uses the same trusted
// `docker exec postgres-main psql` local-access pattern already used by
// api/scripts/collect-overview.js in this repo — no API key, no new secret.
//
// Fails loud (non-zero exit) on any problem, deliberately — this project has been burned
// before by deploy/sync steps that fail silently and sit broken for hours.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const EVENT_TYPE_ID = 1156;
const SLUG = 'daintytrading';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ARTIFACT = path.join(__dirname, '..', 'dist', 'api', 'calcom-event-description.json');

function psql(sql) {
  return execFileSync(
    'docker',
    ['exec', '-i', 'postgres-main', 'psql', '-U', 'postgres', '-d', 'calcom', '-v', 'ON_ERROR_STOP=1', '-t', '-A'],
    { input: sql, encoding: 'utf8' }
  );
}

let artifact;
try {
  artifact = JSON.parse(readFileSync(ARTIFACT, 'utf8'));
} catch (err) {
  throw new Error(`calcom-sync: could not read/parse build artifact at ${ARTIFACT}: ${err.message}`);
}

const { description } = artifact;
if (!description || description.length < 50) {
  throw new Error(`calcom-sync: refusing to sync — generated description looks wrong (${description?.length ?? 0} chars)`);
}

const current = psql(
  `SELECT description FROM "EventType" WHERE id = ${EVENT_TYPE_ID} AND slug = '${SLUG}';`
).trim();

if (current === description) {
  console.log('calcom-sync: description already up to date, no write needed');
  process.exit(0);
}

const escaped = description.replace(/'/g, "''");
psql(`UPDATE "EventType" SET description = '${escaped}' WHERE id = ${EVENT_TYPE_ID} AND slug = '${SLUG}';`);

// UPDATE with no matching row is a silent no-op in SQL — verify explicitly rather than trust it.
const verify = psql(`SELECT description FROM "EventType" WHERE id = ${EVENT_TYPE_ID};`).trim();
if (verify !== description) {
  throw new Error(
    `calcom-sync: UPDATE did not take effect (id ${EVENT_TYPE_ID} not found, or slug changed off '${SLUG}') — check the EventType row manually`
  );
}

console.log(`calcom-sync: description updated for EventType id=${EVENT_TYPE_ID}`);
