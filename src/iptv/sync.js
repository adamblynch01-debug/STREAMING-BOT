const { config } = require('../config');
const { getLogger } = require('../logger');
const { fetchWithRetry } = require('./downloader');
const { parseM3U, parseXMLTV } = require('./parser');
const { cacheRead, cacheClear } = require('../cache');
const { syncChannels, replaceProgrammes, getLatestProgrammeAge } = require('../database');
const { scheduleRefresh } = require('./scheduler');

const logger = getLogger();

async function downloadAndSync(force = false) {
  logger.info('Starting IPTV sync...');

  if (config.PLAYLIST) await syncPlaylist(force);
  if (config.XMLTV)    await syncXMLTV(force);

  cacheClear();
  if (!force) scheduleRefresh();
  logger.info('IPTV sync complete');
}

async function syncPlaylist(force = false) {
  let buf = force ? null : cacheRead('playlist.m3u');
  if (!buf) buf = await fetchWithRetry(config.PLAYLIST, 'playlist.m3u');
  if (!buf) { logger.error('No playlist data available'); return; }

  const channels = parseM3U(buf);
  if (!channels.length) { logger.warn('Playlist parsed 0 channels'); return; }
  syncChannels(channels);
  logger.info(`Synced ${channels.length} channels`);
}

async function syncXMLTV(force = false) {
  if (!force) {
    const age = getLatestProgrammeAge();
    if (age) {
      const ms = Date.now() - new Date(age).getTime();
      const refreshMs = config.REFRESH_INTERVAL * 60 * 1000;
      if (ms < refreshMs) { logger.info('Programme data is fresh, skipping XMLTV download'); return; }
    }
  }

  let buf = force ? null : cacheRead('xmltv.xml');
  if (!buf) buf = await fetchWithRetry(config.XMLTV, 'xmltv.xml');
  if (!buf) { logger.error('No XMLTV data available'); return; }

  const { channels, programmes } = await parseXMLTV(buf);
  if (channels.length) syncChannels(channels);
  if (programmes.length) replaceProgrammes(programmes);
}

function stopRefresh() { require('./scheduler').stopRefresh(); }

module.exports = { downloadAndSync, syncPlaylist, syncXMLTV, stopRefresh };
