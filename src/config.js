require('dotenv').config();

const REQUIRED = ['DISCORD_BOT_TOKEN', 'DISCORD_USER_TOKEN'];

function buildPlaylistUrl() {
  // Support both a direct M3U URL and Xtream Codes login credentials
  if (process.env.PLAYLIST) return process.env.PLAYLIST;
  const { XTREAM_URL, XTREAM_USER, XTREAM_PASS } = process.env;
  if (XTREAM_URL && XTREAM_USER && XTREAM_PASS) {
    const base = XTREAM_URL.replace(/\/$/, '');
    return `${base}/get.php?username=${XTREAM_USER}&password=${XTREAM_PASS}&type=m3u_plus&output=ts`;
  }
  return null;
}

function buildXMLTVUrl() {
  if (process.env.XMLTV) return process.env.XMLTV;
  const { XTREAM_URL, XTREAM_USER, XTREAM_PASS } = process.env;
  if (XTREAM_URL && XTREAM_USER && XTREAM_PASS) {
    const base = XTREAM_URL.replace(/\/$/, '');
    return `${base}/xmltv.php?username=${XTREAM_USER}&password=${XTREAM_PASS}`;
  }
  return null;
}

function load() {
  const missing = REQUIRED.filter(k => !process.env[k]);
  if (missing.length) throw new Error(`Missing required env vars: ${missing.join(', ')}`);

  const playlist = buildPlaylistUrl();
  if (!playlist) throw new Error('No playlist source. Set PLAYLIST or XTREAM_URL+XTREAM_USER+XTREAM_PASS');

  return {
    DISCORD_BOT_TOKEN:  process.env.DISCORD_BOT_TOKEN,
    DISCORD_USER_TOKEN: process.env.DISCORD_USER_TOKEN,
    PLAYLIST:           playlist,
    XMLTV:              buildXMLTVUrl(),
    GUILD:              process.env.GUILD || null,
    REFRESH_INTERVAL:   parseInt(process.env.REFRESH_INTERVAL  || '1440', 10),
    STREAM_TIMEOUT:     parseInt(process.env.STREAM_TIMEOUT    || '10',   10),
    BITRATE_VIDEO:      parseInt(process.env.BITRATE_VIDEO     || '5000', 10),
    BITRATE_VIDEO_MAX:  parseInt(process.env.BITRATE_VIDEO_MAX || '7500', 10),
    DISABLE_TRANSCODE:  process.env.DISABLE_TRANSCODE === 'true',
    MINIMIZE_LATENCY:   process.env.MINIMIZE_LATENCY  !== 'false',
    DEBUG:              process.env.DEBUG === 'true',
  };
}

const config = load();
module.exports = { config };

