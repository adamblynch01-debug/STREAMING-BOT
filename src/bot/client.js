const { Client, GatewayIntentBits, Partials, REST, Routes } = require('discord.js');
const { config } = require('../config');
const { getLogger } = require('../logger');
const { getChannels, getChannelByName } = require('../database');

const logger = getLogger();

const COMMANDS = [
  { name: 'stream',    description: 'Stream a channel into your voice channel', options: [{ name: 'channel', description: 'Channel name', type: 3, required: true, autocomplete: true }] },
  { name: 'stop',      description: 'Stop the stream and leave voice' },
  { name: 'list',      description: 'Browse all channels', options: [{ name: 'group', description: 'Filter by group', type: 3, required: false }, { name: 'page', description: 'Page number', type: 4, required: false }] },
  { name: 'search',    description: 'Search channels by name', options: [{ name: 'query', description: 'Search term', type: 3, required: true }] },
  { name: 'browse',    description: 'Browse channels by category (select menu)' },
  { name: 'programme', description: 'TV programme guide', options: [{ name: 'channel', description: 'Channel name (optional)', type: 3, required: false, autocomplete: true }] },
  { name: 'favorite',  description: 'Manage favorite channels', options: [
    { name: 'action', description: 'add / remove / list', type: 3, required: true, choices: [{ name: 'add', value: 'add' }, { name: 'remove', value: 'remove' }, { name: 'list', value: 'list' }] },
    { name: 'channel', description: 'Channel name', type: 3, required: false, autocomplete: true },
  ]},
  { name: 'status',    description: 'Show bot and stream status' },
  { name: 'refresh',   description: 'Force refresh IPTV data (admin)', options: [{ name: 'type', description: 'What to refresh', type: 3, required: true, choices: [{ name: 'all', value: 'all' }, { name: 'channels', value: 'channels' }, { name: 'programme', value: 'programme' }] }] },
];

async function registerCommands(clientId) {
  const rest = new REST({ version: '10' }).setToken(config.DISCORD_BOT_TOKEN);
  try {
    if (config.GUILD) {
      await rest.put(Routes.applicationGuildCommands(clientId, config.GUILD), { body: COMMANDS });
      logger.info(`Slash commands registered to guild ${config.GUILD}`);
    } else {
      await rest.put(Routes.applicationCommands(clientId), { body: COMMANDS });
      logger.info('Slash commands registered globally');
    }
  } catch (err) { logger.error(`Command registration failed: ${err}`); }
}

function buildClient() {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages],
    partials: [Partials.Channel],
  });

  client.once('ready', async () => {
    logger.info(`Bot ready: ${client.user.tag}`);
    await registerCommands(client.user.id);
  });

  client.on('interactionCreate', async interaction => {
    try {
      if (interaction.isAutocomplete()) return handleAutocomplete(interaction);
      if (!interaction.isChatInputCommand()) return;
      const cmds = require('./commands');
      const handler = cmds[interaction.commandName];
      if (handler) await handler(interaction);
    } catch (err) {
      logger.error(`Interaction error: ${err}`);
      const msg = { content: '❌ Something went wrong.', ephemeral: true };
      if (interaction.deferred || interaction.replied) interaction.followUp(msg).catch(() => {});
      else interaction.reply(msg).catch(() => {});
    }
  });

  return client;
}

function handleAutocomplete(interaction) {
  const focused = interaction.options.getFocused().toLowerCase();
  const results = getChannels({ search: focused, limit: 25 });
  interaction.respond(results.map(c => ({ name: c.tvg_name.slice(0, 100), value: c.tvg_name }))).catch(() => {});
}

module.exports = { buildClient };
