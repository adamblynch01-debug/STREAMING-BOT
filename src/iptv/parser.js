const { parseStringPromise } = require('xml2js');
const { getLogger } = require('../logger');

const logger = getLogger();

// ── M3U parser ────────────────────────────────────────────────────────────────
function parseM3U(content) {
  const channels = [];
  const lines = content.toString().split('\n');
  let current = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith('#EXTINF:')) {
      current = parseExtInf(line);
    } else if (current && line && !line.startsWith('#')) {
      current.url = line;
      channels.push(current);
      current = null;
    }
  }
  logger.debug(`Parsed ${channels.length} channels from M3U`);
  return channels;
}

function parseExtInf(line) {
  const ch = { tvg_id: null, tvg_name: null, tvg_logo: null, group_title: null, url: null };
  const attr = (key) => { const m = line.match(new RegExp(`${key}="([^"]*)"`, 'i')); return m ? m[1].trim() : null; };
  ch.tvg_id     = attr('tvg-id');
  ch.tvg_logo   = attr('tvg-logo');
  ch.group_title = attr('group-title');
  const nameMatch = line.match(/,(.+)$/);
  ch.tvg_name = attr('tvg-name') || (nameMatch ? nameMatch[1].trim() : 'Unknown');
  return ch;
}

// ── XMLTV parser ──────────────────────────────────────────────────────────────
async function parseXMLTV(buffer) {
  const channels = [];
  const programmes = [];
  try {
    const xml = await parseStringPromise(buffer.toString(), { explicitArray: false, mergeAttrs: true });
    const tv = xml.tv || {};

    // Channels
    const rawChannels = Array.isArray(tv.channel) ? tv.channel : (tv.channel ? [tv.channel] : []);
    for (const c of rawChannels) {
      channels.push({
        tvg_id: c.id || null,
        tvg_name: (typeof c['display-name'] === 'string' ? c['display-name'] : c['display-name']?._ || c.id) || 'Unknown',
        tvg_logo: c.icon?.src || null,
        group_title: null,
        url: '',
      });
    }

    // Programmes
    const rawProg = Array.isArray(tv.programme) ? tv.programme : (tv.programme ? [tv.programme] : []);
    for (const p of rawProg) {
      const startTs = parseXMLTVDate(p.start);
      const stopTs  = parseXMLTVDate(p.stop);
      if (!startTs || !stopTs) continue;
      programmes.push({
        channel_tvg_id: p.channel || null,
        title:          typeof p.title === 'string' ? p.title : (p.title?._ || null),
        description:    typeof p.desc  === 'string' ? p.desc  : (p.desc?._  || null),
        category:       typeof p.category === 'string' ? p.category : (p.category?._ || null),
        start_ts:  startTs,
        stop_ts:   stopTs,
      });
    }
    logger.info(`XMLTV parsed: ${channels.length} channels, ${programmes.length} programmes`);
  } catch (err) {
    logger.error(`XMLTV parse error: ${err.message}`);
  }
  return { channels, programmes };
}

function parseXMLTVDate(str) {
  if (!str || str.length < 14) return null;
  try {
    const y=str.slice(0,4), mo=str.slice(4,6), d=str.slice(6,8);
    const h=str.slice(8,10), mi=str.slice(10,12), s=str.slice(12,14);
    const offset = str.length > 14 ? str.slice(14).trim() : '';
    let ms = Date.UTC(+y,+mo-1,+d,+h,+mi,+s);
    if (offset) {
      const sign = offset[0]==='+' ? -1 : 1;
      ms += sign * ((parseInt(offset.slice(1,3))*60 + parseInt(offset.slice(3,5)||'0')) * 60000);
    }
    return Math.floor(ms / 1000);
  } catch { return null; }
}

module.exports = { parseM3U, parseXMLTV };
