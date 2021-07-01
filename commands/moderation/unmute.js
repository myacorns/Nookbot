// eslint-disable-next-line consistent-return
module.exports.run = async (client, message, args, level) => { // eslint-disable-line no-unused-vars
  // Sets the member to the user mentioned
  let member = message.mentions.members.first() || client.guilds.cache.get(client.config.mainGuild).members.cache.get(args[0]);

  if (!member) {
    if (parseInt(args[0], 10)) {
      try {
        member = await client.guilds.cache.get(client.config.mainGuild).members.fetch(args[0]);
      } catch (err) {
        return client.error(message.channel, 'Invalid Member!', 'Please mention a valid member of this server!');
      }
    }
  }

  // Removes the role from the member
  member.roles.remove(client.config.freezedRole)
    .then(() => client.success(message.channel, 'Success!', `${message.author}, I've successfully unfreezed ${member}!`))
    .catch((err) => client.error(message.channel, 'Error!', `Failed to unfreeze member! Error: ${err}`));
};

module.exports.conf = {
  guildOnly: true,
  aliases: ['um'],
  permLevel: 'Redd',
  args: 1,
};

module.exports.help = {
  name: 'unfreeze',
  category: 'moderation',
  description: 'Removes the mentioned user the freezed role',
  usage: 'unfreeze <@user>',
  details: '<@user> => Any valid member of the server',
};
