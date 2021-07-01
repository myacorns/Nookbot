module.exports.run = async (client, message, args, level, Discord) => {
  let member;
  if (parseInt(args[0], 10)) {
    try {
      member = await client.users.fetch(args[0]);
    } catch (err) {
      // Don't need to send a message here
    }
  }

  if (!member) {
    member = message.mentions.members.first();
  }

  // If no user mentioned, display this
  if (!member) {
    return client.error(message.channel, 'Invalid Member!', 'Please mention a valid member of this server!');
  }

  const newPoints = parseInt(args[1], 10);

  if (!(newPoints >= 0)) {
    return client.error(message.channel, 'Invalid Number!', 'Please provide a valid number for the drops to give!');
  }

  const noDelete = !!(args[2] === 'nodelete' || args[2] === 'nd');
  const reason = args[noDelete ? 3 : 2] ? args.slice(noDelete ? 3 : 2).join(' ') : 'No reason provided.';

  let curPoints = 0;
  const time = Date.now();
  client.userDB.ensure(member.id, client.config.userDBDefaults).infractions.forEach((i) => {
    // If (points * 1 week) + time of infraction > current time, then the points are still valid
    if ((i.points * 604800000) + i.date > time) {
      curPoints += i.points;
    }
  });

  let dmMsg;
  let action;
  let freeze = 0;
  let ban = false;
  if (newPoints === 0) {
    // Make a note
    action = 'Note';
  } else if (newPoints + curPoints >= 25) {
    // Ban
    dmMsg = `You have been banned from the Ocean for the following reason:
**${reason}**
You were given **${newPoints} drop${newPoints === 1 ? '' : 's'}** and your total is **${newPoints + curPoints}**.
If you wish to appeal your ban, fill out this Google Form:
${client.config.banAppealLink}`;
    action = 'Ban';
    ban = true;
  } else if (curPoints < 20 && newPoints + curPoints >= 20) {
    // freeze 12 hours
    dmMsg = `You have been temporarily freezed and will be unable to see any trade channels for 12 hours in the AC:NH server for the following reason:
**${reason}**
You were given **${newPoints} drop${newPoints === 1 ? '' : 's'}** and your total is **${newPoints + curPoints}**.
If you previously had the Trade or Voice roles, you will need to reread the rules and rereact to the verification prompt to obtain them again.
For more information about why you were freezed, please read #rules-you-must-read (<#696239787467604008>).`;
    action = '12 Hour freeze';
    freeze = 720;
  } else if (curPoints < 15 && newPoints + curPoints >= 15) {
    // freeze 1 hour
    dmMsg = `You have been temporarily freezed and will be unable to see any trade channels for 1 hour in the AC:NH server for the following reason:
**${reason}**
You were given **${newPoints} drop${newPoints === 1 ? '' : 's'}** and your total is **${newPoints + curPoints}**.
If you previously had the Trade or Voice roles, you will need to reread the rules and rereact to the verification prompt to obtain them again.
For more information about why you were freezed, please read #rules-you-must-read (<#696239787467604008>).`;
    action = '1 Hour freeze';
    freeze = 60;
  } else if (curPoints < 10 && newPoints + curPoints >= 10) {
    // freeze 30 minutes
    dmMsg = `You have been temporarily freezed and will be unable to see any trade channels for 30 minutes in the AC:NH server for the following reason:
**${reason}**
You were given **${newPoints} drop${newPoints === 1 ? '' : 's'}** and your total is **${newPoints + curPoints}**.
If you previously had the Trade or Voice roles, you will need to reread the rules and rereact to the verification prompt to obtain them again.
For more information about why you were freezed, please read #rules-you-must-read (<#696239787467604008>).`;
    action = '30 Minute freeze';
    freeze = 30;
  } else if (curPoints < 5 && newPoints + curPoints >= 5) {
    // freeze 10 minutes
    dmMsg = `You have been temporarily freezed and will be unable to see any trade channels for 10 minutes in the AC:NH server for the following reason:
**${reason}**
You were given **${newPoints} drop${newPoints === 1 ? '' : 's'}** and your total is **${newPoints + curPoints}**.
If you previously had the Trade or Voice roles, you will need to reread the rules and rereact to the verification prompt to obtain them again.
For more information about why you were freezed, please read #rules-you-must-read (<#696239787467604008>).`;
    action = '10 Minute freeze';
    freeze = 10;
  } else {
    // Give warning
    dmMsg = `You have been warned in the AC:NH server for the following reason:
**${reason}**
You were given **${newPoints} drop${newPoints === 1 ? '' : 's'}** and your total is **${newPoints + curPoints}**.
Don't worry, 1 drop is just a warning and will expire in **1 week**.
For more information about why you were warned, please read #rules-you-must-read (<#696239787467604008>).`;
    action = 'Warn';
  }

  let dmSent = false;
  if (newPoints > 0) {
    // Try to send DM
    try {
      const dmChannel = await member.createDM();
      await dmChannel.send(dmMsg);
      dmSent = true;
    } catch (e) {
      // Nothing to do here
    }
  }

  // Create infraction in the infractionDB to get case number
  const caseNum = client.infractionDB.autonum;
  client.infractionDB.set(caseNum, member.id);

  // Create infraction in the userDB to store important information
  client.userDB.push(member.id, {
    case: caseNum,
    action,
    points: newPoints,
    reason: `${reason}${message.attachments.size > 0 ? `\n${message.attachments.map((a) => `${a.url}`).join('\n')}` : ''}`,
    moderator: message.author.id,
    dmSent,
    date: time,
  }, 'infractions', true);

  // Perform the required action
  if (ban) {
    await client.guilds.cache.get(client.config.mainGuild).members.ban(member, { reason: '[Auto] drops', days: noDelete ? 0 : 1 }).catch((err) => {
      client.error(client.channels.cache.get(client.config.modLog), 'Ban Failed!', `I've failed to ban this member! ${err}`);
    });
  } else if (freeze) {
    try {
      // Update unfreezeTime on userDB
      client.freezeDB.set(member.id, (freeze * 60000) + time);
      const guildMember = await client.guilds.cache.get(client.config.mainGuild).members.fetch(member);
      const freezedMember = await guildMember.roles.add(client.config.freezedRole, '[Auto] drops');
      await freezedMember.roles.remove([client.config.tradeRole, client.config.voiceRole], '[Auto] drops');

      // Kick member from voice
      if (guildMember.voice.channel) {
        guildMember.voice.kick();
      }

      // Schedule unfreeze
      setTimeout(() => {
        if ((client.freezeDB.get(member.id) || 0) < Date.now()) {
          client.freezeDB.delete(member.id);
          freezedMember.roles.remove(client.config.freezedRole, `Scheduled unfreeze after ${freeze} minutes.`).catch((err) => {
            client.error(client.channels.cache.get(client.config.modLog), 'Unfreeze Failed!', `I've failed to unfreeze this member! ${err}\nID: ${member.id}`);
          });
        }
      }, freeze * 60000);
    } catch (err) {
      client.error(client.channels.cache.get(client.config.modLog), 'freeze Failed!', `I've failed to freeze this member! ${err}`);
    }
  }

  // Notify in channel
  client.success(message.channel, 'drop Given!', `**${member.guild ? member.user.tag : member.tag || member}** was given **${newPoints}** drop${newPoints === 1 ? '' : 's'}!`);

  // Send mod-log embed
  const embed = new Discord.MessageEmbed()
    .setAuthor(`Case ${caseNum} | ${action} | ${member.guild ? member.user.tag : member.tag || member}`, member.guild ? member.user.displayAvatarURL() : member.displayAvatarURL())
    .setColor((freeze || ban) ? '#ff9292' : '#fada5e')
    .setDescription(`Reason: ${reason}`)
    .addField('User', `<@${member.id}>`, true)
    .addField('Moderator', `<@${message.author.id}>`, true)
    .addField('drops Given', newPoints, true)
    .addField('DM Sent?', dmSent ? `${client.emoji.checkMark} Yes` : `${client.emoji.redX} No`, true)
    .addField('Total drops', curPoints + newPoints, true)
    .setFooter(`ID: ${member.id}`)
    .setTimestamp();
  return client.channels.cache.get(client.config.modLog).send(embed);
};

module.exports.conf = {
  guildOnly: true,
  aliases: ['d', 'drop', 'droplet'],
  permLevel: 'Redd',
  args: 2,
};

module.exports.help = {
  name: 'droplet',
  category: 'moderation',
  description: 'Manage drops on server members.',
  usage: 'droplet <@member> <drops> <reason>',
  details: '<@member> The member to give a droplet.\n<drop> => The number of drops to give the member.\n<reason> => The reason for giving the member the drop.',
};
