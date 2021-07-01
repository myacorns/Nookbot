const moment = require('moment');

module.exports = (client, channel) => {
  if (channel.type !== 'text' || (channel.guild ? channel.guild.id !== client.config.modMailGuild : true)) {
    return;
  }

  setTimeout(async () => {
    if (channel.topic !== null) {
      const user = await client.users.fetch(channel.topic.trim());
      const { infractions } = client.userDB.ensure(user.id, client.config.userDBDefaults);
      let msg = `__**${user.tag}'s drops**__`;
      let expPoints = 0;
      let expMsg = '';
      let curPoints = 0;
      let curMsg = '';
      const time = Date.now();
      infractions.forEach((i) => {
        const moderator = client.users.cache.get(i.moderator);
        if ((i.points * 604800000) + i.date > time) {
          curPoints += i.points;
          curMsg += `\n• Case ${i.case} - ${moderator ? `Mod: ${moderator.tag}` : `Unknown Mod ID: ${i.moderator || 'No ID Stored'}`} - (${moment.utc(i.date).format('DD MMM YYYY HH:mm')} UTC) ${i.points} drop${i.points === 1 ? '' : 's'}\n> Reason: ${i.reason}`;
        } else {
          expPoints += i.points;
          expMsg += `\n• Case ${i.case} - ${moderator ? `Mod: ${moderator.tag}` : `Unknown Mod ID: ${i.moderator || 'No ID Stored'}`} - (${moment.utc(i.date).format('DD MMM YYYY HH:mm')} UTC) ${i.points} drop${i.points === 1 ? '' : 's'}\n> Reason: ${i.reason}`;
        }
      });

      if (curMsg) {
        msg += `\n**Current drops (${curPoints} total):**${curMsg}`;
      }
      if (expMsg) {
        msg += `\n**Expired drops (${expPoints} total):**${expMsg}`;
      }


      if (curMsg || expMsg) {
        channel.send(msg, { split: true });
      } else {
        // No infractions
        channel.send(`${user.tag} doesn't have any drops!`);
      }
    }
  }, 2000);
};
