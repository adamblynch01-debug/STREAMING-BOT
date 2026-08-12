require('dotenv').config();

const REQUIRED = ['DISCORD_BOT_TOKEN', 'DISCORD_USER_TOKEN', 'PLAYLIST'];

function load() {
  const missing = REQUIRED.filter(k => !process.env[k]);
  if (missing.length) throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  return {
    DISCORD_BOT_TOKEN:  process.env.DISCORD_BOT_TOKEN,
    DISCORD_USER_TOKEN: process.env.DISCORD_USER_TOKEN,
    PLAYLIST:           process.env.PLAYLIST,
    XMLTV:              process.env.XMLTV || null,
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
