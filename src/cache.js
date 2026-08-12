const os = require('os');
const path = require('path');
const { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } = require('fs');

const CACHE_DIR = path.join(os.tmpdir(), 'luminary-cache');

function ensureCache() { mkdirSync(CACHE_DIR, { recursive: true }); }
function cachePath(name) { return path.join(CACHE_DIR, name); }

function cacheWrite(name, buffer) {
  ensureCache();
  writeFileSync(cachePath(name), buffer);
}

function cacheRead(name) {
  const p = cachePath(name);
  return existsSync(p) ? readFileSync(p) : null;
}

function cacheFilePath(name) {
  const p = cachePath(name);
  return existsSync(p) ? p : null;
}

function cacheClear() {
  if (existsSync(CACHE_DIR)) rmSync(CACHE_DIR, { recursive: true, force: true });
}

module.exports = { cacheWrite, cacheRead, cacheFilePath, cacheClear };
