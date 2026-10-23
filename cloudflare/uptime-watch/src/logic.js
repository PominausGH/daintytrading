// Pure helpers for the uptime-watch worker (unit tested in Node). The priority rules copy
// api/lib/support-alerts.js so a push looks the same whichever monitor sends it:
//   Care + Scale, 7am-10pm Sydney -> 2 (emergency, repeats until acknowledged)
//   other Care, business hours    -> 1
//   everything else               -> 0 (never wakes anyone)

const TZ = 'Australia/Sydney';

export function sydneyClock(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-AU', { timeZone: TZ, weekday: 'short', hour: 'numeric', hourCycle: 'h23' })
      .formatToParts(now)
      .map((p) => [p.type, p.value])
  );
  return { hour: parseInt(parts.hour, 10), weekday: parts.weekday };
}

const inWakeHours = (now) => { const { hour } = sydneyClock(now); return hour >= 7 && hour < 22; };
const inBusinessHours = (now) => {
  const { hour, weekday } = sydneyClock(now);
  return !['Sat', 'Sun'].includes(weekday) && hour >= 9 && hour < 17;
};

export function priorityFor(client, now = new Date()) {
  if (!client || !client.care) return 0;
  if (String(client.plan).toLowerCase() === 'scale' && inWakeHours(now)) return 2;
  if (inBusinessHours(now)) return 1;
  return 0;
}

export function sitesFrom(clients) {
  return (clients || []).filter((c) => c.care).flatMap((c) =>
    (c.sites || []).map((s) => (typeof s === 'string' ? { url: s, expect: null, client: c } : { url: s.url, expect: s.expect || null, client: c }))
  ).filter((s) => s.url);
}

// The TelaLoom server itself. When it's down, URGENT emails can't push either, so it takes the
// highest priority of any client it would let down.
export function serverClient(clients) {
  const scale = (clients || []).some((c) => c.care && String(c.plan).toLowerCase() === 'scale');
  return { name: 'TelaLoom server (API, URGENT email, local monitor)', plan: scale ? 'scale' : 'care', care: true };
}

export function judge(res, body, expect) {
  // 429 = the site answered but its rate limiter turned us away (cvmatcher allows 50
  // page loads/hour per IP and we check 60). It's up; treating it as down made
  // alerts flap all day.
  if (res.status === 429) return { up: true, status: 429, rateLimited: true };
  if (res.status >= 400) return { up: false, detail: `HTTP ${res.status}` };
  if (expect && !String(body).toLowerCase().includes(String(expect).toLowerCase())) {
    return { up: false, detail: `page loads (HTTP ${res.status}) but "${expect}" is missing` };
  }
  return { up: true, status: res.status };
}

// Compare this run's results with stored state. Returns the new state and what changed.
// results: [{ url, name, client, up, detail }]
export function diff(prev, results, nowMs) {
  const next = {};
  const wentDown = [];
  const cameBack = [];
  for (const r of results) {
    const was = prev[r.url];
    if (r.up) {
      if (was && was.down) cameBack.push({ ...r, mins: Math.max(1, Math.round((nowMs - was.since) / 60000)) });
      continue; // up sites aren't stored
    }
    next[r.url] = was && was.down ? was : { down: true, since: nowMs };
    if (!(was && was.down)) wentDown.push(r);
  }
  return { next, wentDown, cameBack };
}

// One push per run, so a server outage taking several sites down is one alert, not five.
export function buildPushes(wentDown, cameBack, now = new Date()) {
  const pushes = [];
  if (wentDown.length) {
    const priority = Math.max(...wentDown.map((r) => priorityFor(r.client, now)));
    pushes.push({
      title: wentDown.length === 1 ? `DOWN: ${wentDown[0].name}` : `DOWN: ${wentDown.length} sites`,
      message: wentDown.map((r) => `${r.name}: ${r.url} (${r.detail})`).join('\n') + '\n\nChecked 3 times over 40s from Cloudflare.',
      priority,
      url: wentDown[0].url,
    });
  }
  if (cameBack.length) {
    pushes.push({
      title: cameBack.length === 1 ? `Back up: ${cameBack[0].name}` : `Back up: ${cameBack.length} sites`,
      message: cameBack.map((r) => `${r.name}: back after ${r.mins} min`).join('\n'),
      priority: 0,
    });
  }
  return pushes;
}
