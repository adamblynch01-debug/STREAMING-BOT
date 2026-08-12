const axios = require('axios');
const { getLogger } = require('../logger');
const { cacheWrite, cacheRead } = require('../cache');

const logger = getLogger();
const MAX_RETRIES = 3;
const MAX_SIZE = 50 * 1024 * 1024; // 50 MB

async function fetchWithRetry(url, cacheKey) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      logger.debug(`Fetching ${cacheKey} (attempt ${attempt})`);
      const res = await axios.get(url, {
        responseType: 'arraybuffer',
        maxContentLength: MAX_SIZE,
        maxBodyLength: MAX_SIZE,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const buf = Buffer.from(res.data);
      res.data = null;
      cacheWrite(cacheKey, buf);
      logger.info(`Downloaded ${cacheKey} — ${(buf.length / 1024).toFixed(0)} KB`);
      return buf;
    } catch (err) {
      clearTimeout(timeout);
      const delay = Math.pow(2, attempt) * 1000;
      logger.warn(`Fetch ${cacheKey} attempt ${attempt} failed: ${err.message}`);
      if (attempt < MAX_RETRIES) await new Promise(r => setTimeout(r, delay));
    }
  }
  // All attempts failed — try cache fallback
  const cached = cacheRead(cacheKey);
  if (cached) { logger.warn(`Using stale cache for ${cacheKey}`); return cached; }
  logger.error(`Failed to fetch ${cacheKey} and no cache available`);
  return null;
}

module.exports = { fetchWithRetry };
