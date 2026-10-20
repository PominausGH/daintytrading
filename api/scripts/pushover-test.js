#!/usr/bin/env node
'use strict';
// Send a test push: docker exec daintytrading-api node scripts/pushover-test.js [priority]
// priority 2 = emergency (repeats every 60s until acknowledged; tap Acknowledge in the app).
require('dotenv').config();
const { sendPush } = require('../lib/pushover');

const priority = parseInt(process.argv[2] || '0', 10);
sendPush({
  title: 'TelaLoom alert test',
  message: `Test push at priority ${priority}. If this woke you up, critical alerts work.`,
  priority,
}).then((r) => {
  console.log(r.ok ? 'sent' : `not sent: ${JSON.stringify(r)}`);
  process.exit(r.ok ? 0 : 1);
});
