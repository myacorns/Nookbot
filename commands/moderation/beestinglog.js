const moment = require('moment');
const timezones = require('../../src/timezones.json');

// eslint-disable-next-line consistent-return
module.exports.run = async (client, message, args, level) => {
  let member;
  if (args.length > 0 && level >= 2) {
    // Mods can see other's infractions
    member = message.mentions.members.first();
    if (!member) {
      if (parseInt(args[0], 10)) {
        try {
          member = await client.users.fetch(args[0]);
        } catch (err) {
          // Don't need to send a message here
        }
      }
    }

    // If no user mentioned, display this
    if (!member) {
      return client.error(message.channel, 'Invalid Member!', 'Please mention a valid member of this server!');
    }
  } else {
    member = message.author;
  }

  const { infractions } = client.userDB.ensure(member.id, client.config.userDBDefaults);
  let msg = `__**${member.guild ? member.user.tag : `${member.username}#${member.discriminator}`}'s drops**__`;
  let expPoints = 0;
  let expMsg = '';
  let curPoints = 0;
  let curMsg = '';

  const time = Date.now();
  let tz = args.find((arg) => timezones[arg.toUpperCase()]);
  tz = tz ? tz.toUpperCase() : 'UTC';
  let offset = timezones[tz];

  if (offset === undefined) {
    offset = 0;
  }

  // eslint-disable-next-line no-restricted-globals
  let timeToUse = args.find((arg) => client.timeRegex.test(arg) && arg !== member.id);
  if (!timeToUse || (timeToUse.toLowerCase() !== '24h' && timeToUse.toLowerCase() !== '12h')) {
    timeToUse = '24h';
  }

  infractions.forEach((i) => {
    // Only allow mods to see zero point drops, called notes, on a user
    if (i.points > 0 || level >= 2) {
      const moderator = client.users.cache.get(i.moderator);
      if ((i.points * 604800000) + i.date > time) {
        curPoints += i.points;
        curMsg += `\n• Case ${i.case} -${level >= 2 ? ` ${moderator ? `Mod: ${moderator.tag}` : `Unknown Mod ID: ${i.moderator || 'No ID Stored'}`} -` : ''} (${moment.utc(i.date).add(offset, 'hours').format(`DD MMM YYYY ${timeToUse === '12h' ? 'hh:mm:ss a' : 'HH:mm:ss'}`)} ${tz}) ${i.points} drop${i.points === 1 ? '' : 's'}\n> Reason: ${i.reason}`;
      } else {
        expPoints += i.points;
        expMsg += `\n• Case ${i.case} -${level >= 2 ? ` ${moderator ? `Mod: ${moderator.tag}` : `Unknown Mod ID: ${i.moderator || 'No ID Stored'}`} -` : ''} (${moment.utc(i.date).add(offset, 'hours').format(`DD MMM YYYY ${timeToUse === '12h' ? 'hh:mm:ss a' : 'HH:mm:ss'}`)} ${tz}) ${i.points} drop${i.points === 1 ? '' : 's'}\n> Reason: ${i.reason}`;
      }
    }
  });

  if (curMsg) {
    msg += `\n**Current drops (${curPoints} total):**${curMsg}`;
  }
  if (expMsg) {
    msg += `\n**Expired drops (${expPoints} total):**${expMsg}`;
  }

  // Where to send message
  if (args.length > 0 && level >= 2) {
    if (curMsg || expMsg) {
      return message.channel.send(msg, { split: true });
    }
    // No infractions
    return message.channel.send(`${member.guild ? member.user.tag : `${member.username}#${member.discriminator}`} doesn't have any drops!`);
  }
  // Try to send DM
  try {
    const dmChannel = await member.createDM();
    if (curMsg || expMsg) {
      await dmChannel.send(msg, { split: true });
    } else {
      await dmChannel.send('You do not have any drops!');
    }
    if (message.channel.type !== 'dm') {
      return message.channel.send("I've sent you a DM!");
    }
  } catch (e) {
    // Send basic version in channel
    if (curMsg || expMsg) {
      return message.channel.send(`I was unable to send a detailed list of your drops to your direct messages, so here is some basic info:
**Current drops**: ${curPoints} drop${curPoints === 1 ? '' : 's'}
**Expired drops**: ${expPoints} drop${expPoints === 1 ? '' : 's'}`);
    }
    return message.channel.send('You do not have any drops!');
  }
};

module.exports.conf = {
  guildOnly: false,
  aliases: ['dl', 'droplog', 'dropslog', 'dropletlog'],
  permLevel: 'User',
};

module.exports.help = {
  name: 'droplog',
  category: 'moderation',
  description: 'Shows a list of drops given to a member',
  usage: 'droplog <@member> <timezone> <time to use>',
  details: '<@member> => The member to list drops for.\n<timezone> => The timezone used to display the time drops were issued. Defaults to UTC.\n<time to use> => 12 or 24. Whether to use 12 or 24 hour time. Defaults to 24.',
};
