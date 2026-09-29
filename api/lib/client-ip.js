'use strict';
const net = require('net');

/**
 * The visitor's real IP.
 *
 * Traffic reaches the API as Cloudflare -> Nginx Proxy Manager -> the dainty nginx container -> here,
 * so `req.ip` is always a private proxy address (verified from stored submissions: 192.168.x.x /
 * 172.x.x.x) and per-IP rate limits keyed on it collapse into one shared bucket for every visitor.
 * Cloudflare puts the real address in CF-Connecting-IP. That header is trustworthy here because the
 * origin only accepts Cloudflare connections (Authenticated Origin Pulls); anything that somehow
 * arrives without it falls back to req.ip.
 */
function clientIp(req) {
  const cf = req.headers && req.headers['cf-connecting-ip'];
  if (typeof cf === 'string') {
    const ip = cf.trim();
    if (net.isIP(ip)) return ip;
  }
  return req.ip;
}

module.exports = { clientIp };
