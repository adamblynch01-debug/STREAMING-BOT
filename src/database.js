const Database = require('better-sqlite3');
const path = require('path');
const { mkdirSync } = require('fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'luminary.db');
let db;

function initDatabase() {
  mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS channels (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      tvg_id      TEXT,
      tvg_name    TEXT NOT NULL UNIQUE,
      tvg_logo    TEXT,
      group_title TEXT,
      url         TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_ch_group ON channels(group_title);
    CREATE TABLE IF NOT EXISTS programmes (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_tvg_id TEXT,
      title          TEXT,
      description    TEXT,
      category       TEXT,
      start_ts       INTEGER,
      stop_ts        INTEGER,
      created_at     TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_prog_ch   ON programmes(channel_tvg_id);
    CREATE INDEX IF NOT EXISTS idx_prog_time ON programmes(start_ts, stop_ts);
    CREATE TABLE IF NOT EXISTS favorites (
      user_id    TEXT NOT NULL,
      guild_id   TEXT NOT NULL,
      channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
      added_at   TEXT NOT NULL,
      PRIMARY KEY (user_id, guild_id, channel_id)
    );
  `);
  require('./logger').getLogger().info(`Database ready — ${DB_PATH}`);
}

const now = () => new Date().toISOString();

// ── Channels ──────────────────────────────────────────────────────────────────
function getChannels({ group, search, limit = 500, offset = 0 } = {}) {
  let sql = 'SELECT * FROM channels WHERE 1=1';
  const p = [];
  if (group)  { sql += ' AND group_title = ?'; p.push(group); }
  if (search) { sql += ' AND (tvg_name LIKE ? OR group_title LIKE ?)'; p.push(`%${search}%`, `%${search}%`); }
  sql += ' ORDER BY tvg_name COLLATE NOCASE LIMIT ? OFFSET ?';
  p.push(limit, offset);
  return db.prepare(sql).all(...p);
}
function getChannelByName(name) { return db.prepare('SELECT * FROM channels WHERE tvg_name = ? COLLATE NOCASE').get(name); }
function getChannelById(id)     { return db.prepare('SELECT * FROM channels WHERE id = ?').get(id); }
function getChannelCount()      { return db.prepare('SELECT COUNT(*) n FROM channels').get().n; }
function getGroups()            { return db.prepare("SELECT DISTINCT group_title FROM channels WHERE group_title IS NOT NULL ORDER BY group_title").all().map(r => r.group_title); }

function syncChannels(channels) {
  const ins = db.prepare(`INSERT INTO channels (tvg_id,tvg_name,tvg_logo,group_title,url,updated_at) VALUES (?,?,?,?,?,?)
    ON CONFLICT(tvg_name) DO UPDATE SET url=excluded.url, tvg_id=COALESCE(excluded.tvg_id,tvg_id),
    tvg_logo=COALESCE(excluded.tvg_logo,tvg_logo), group_title=COALESCE(excluded.group_title,group_title), updated_at=excluded.updated_at`);
  db.transaction(() => { for (const c of channels) ins.run(c.tvg_id||null,c.tvg_name,c.tvg_logo||null,c.group_title||null,c.url,now()); })();
}

// ── Programmes ────────────────────────────────────────────────────────────────
function getProgrammes(tvgId, fromTs) {
  return db.prepare('SELECT * FROM programmes WHERE channel_tvg_id=? AND stop_ts>=? ORDER BY start_ts ASC LIMIT 15').all(tvgId, fromTs || Math.floor(Date.now()/1000));
}
function getProgrammeCount()    { return db.prepare('SELECT COUNT(*) n FROM programmes').get().n; }
function getLatestProgrammeAge(){ const r = db.prepare('SELECT created_at FROM programmes ORDER BY id DESC LIMIT 1').get(); return r ? r.created_at : null; }
function replaceProgrammes(programmes) {
  const ins = db.prepare('INSERT INTO programmes (channel_tvg_id,title,description,category,start_ts,stop_ts,created_at) VALUES (?,?,?,?,?,?,?)');
  db.transaction(() => { db.prepare('DELETE FROM programmes').run(); for (const p of programmes) ins.run(p.channel_tvg_id||null,p.title||null,p.description||null,p.category||null,p.start_ts,p.stop_ts,now()); })();
}

// ── Favorites ─────────────────────────────────────────────────────────────────
function getFavorites(userId, guildId) {
  return db.prepare('SELECT c.* FROM favorites f JOIN channels c ON c.id=f.channel_id WHERE f.user_id=? AND f.guild_id=? ORDER BY f.added_at DESC').all(userId, guildId);
}
function addFavorite(userId, guildId, channelId) {
  try { db.prepare('INSERT INTO favorites (user_id,guild_id,channel_id,added_at) VALUES (?,?,?,?)').run(userId,guildId,channelId,now()); return true; } catch { return false; }
}
function removeFavorite(userId, guildId, channelId) {
  return db.prepare('DELETE FROM favorites WHERE user_id=? AND guild_id=? AND channel_id=?').run(userId,guildId,channelId).changes > 0;
}

module.exports = { initDatabase, getChannels, getChannelByName, getChannelById, getChannelCount, getGroups, syncChannels, getProgrammes, getProgrammeCount, getLatestProgrammeAge, replaceProgrammes, getFavorites, addFavorite, removeFavorite };
