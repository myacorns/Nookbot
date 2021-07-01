const schedule = require('node-schedule');
const moment = require('moment');

module.exports = (client) => {
  if (!client.firstReady) {
    let counter = 1;
    client.firstReady = true;
    console.log('First ready event triggered, loading the guild.');
    const intv = setInterval(async () => {
      const mainGuild = client.guilds.cache.get(client.config.mainGuild);
      const modMailGuild = client.guilds.cache.get(client.config.modMailGuild);
      if (!mainGuild || !modMailGuild) {
        console.log(`  Attempting to wait for both guilds to load ${counter}...`);
        counter += 1;
        return;
      }
      clearInterval(intv);
      console.log('Guilds successfully loaded.');

      // Emoji usage tracking database init
      mainGuild.emojis.cache.forEach((e) => {
        // If EmojiDB does not have the emoji, add it.
        if (!client.emojiDB.has(e.id)) {
          client.emojiDB.set(e.id, 0);
        }
      });
      // Sweep emojis from the DB that are no longer in the guild emojis
      client.emojiDB.sweep((v, k) => !mainGuild.emojis.cache.has(k));

      setInterval(() => {
        try {
          client.memberStats.set(client.memberStats.autonum, { time: Date.now(), members: mainGuild.memberCount });
          client.user.setActivity(`ACNH with ${mainGuild.memberCount} users!`);
        } catch (e) {
          // Don't need any handling
        }
      }, 30000);

      // Save the current collection of guild invites.
      mainGuild.fetchInvites().then((guildInvites) => {
        client.invites = guildInvites;
      });

      // Clear any session channels from the server if they have no members
      client.sessionDB.keyArray().forEach((sesID) => {
        const sessionChannel = client.channels.cache.get(sesID);
        if (sessionChannel && sessionChannel.members.size === 0
            && !sessionChannel.deleted && sessionChannel.deletable) {
          // Session is empty, delete the channel and database entry
          sessionChannel.delete('[Auto] Purged empty session channels on ready event.').then((delChannel) => {
            // Delete sessionDB entry
            client.sessionDB.delete(delChannel.id);
          }).catch((error) => {
            console.error(error);
          });
        }
      });

      // Reschedule any unfreezes from freezeDB
      const now = Date.now();
      client.freezeDB.keyArray().forEach((memID) => {
        const unfreezeTime = client.freezeDB.get(memID);
        mainGuild.members.fetch(memID).then((member) => {
          if (unfreezeTime < now) {
            // Immediately unfreeze
            client.freezeDB.delete(memID);
            member.roles.remove(client.config.freezedRole, 'Scheduled unfreeze through reboot.');
          } else {
            // Schedule unfreeze
            setTimeout(() => {
              if ((client.freezeDB.get(memID) || 0) < Date.now()) {
                client.freezeDB.delete(memID);
                member.roles.remove(client.config.freezedRole, 'Scheduled unfreeze through reboot.');
              }
            }, unfreezeTime - now);
          }
        }).catch(() => {
          // Probably no longer a member, don't schedule their unfreeze and remove entry from DB.
          client.freezeDB.delete(memID);
        });
      });

      // Cache messages for reaction roles
      client.reactionRoleDB.keyArray().forEach((msgID) => {
        const { channel } = client.reactionRoleDB.get(msgID);
        client.channels.cache.get(channel).messages.fetch(msgID);
      });

      // Cache signup sheet
      const data = client.reactionSignUp.get('data');
      client.channels.cache.get(data.channelID).messages.fetch(data.messageID);

      // Cache middleman sheet and request channel message
      const middlemanChannel = client.channels.cache.get('776980847273967626');
      const requestChannel = client.channels.cache.get('750150303692619817');
      const middlemanMsg = await middlemanChannel.messages.fetch('781387060807729192');
      await middlemanMsg.reactions.cache.first().users.fetch();
      await requestChannel.messages.fetch('782464950798516244');

      // Schedule reset of signup stats
      schedule.scheduleJob({ dayOfWeek: 0, hour: 0, minute: 0 }, async () => {
        const mods = client.reactionSignUp.map((v, k) => ({ id: k, hours: v.hours ? v.hours.total : undefined })).sort((a, b) => b.hours - a.hours);
        let msg = `**Sign Up Sheet Statistics (Week ${moment().subtract(7, 'days').format('DD/MM/YYYY')} - ${moment().subtract(1, 'days').format('DD/MM/YYYY')})**\nRank - Name - Hours\nChannel/Category - Hours`;
        await client.asyncForEach(mods, async (k, i) => {
          if (k.id !== 'data') {
            const guild = client.guilds.cache.get(client.config.mainGuild);
            const modMember = guild.members.cache.get(k.id) || await guild.members.fetch(k.id);
            msg += `\n#${i + 1} - **${modMember.displayName}** (${k.id}) - \`${k.hours} hours\``;

            const mod = client.reactionSignUp.get(k.id);
            const { channelHours } = client.addHours(mod);
            msg += channelHours.length === 0 ? '\n' : `\n${channelHours.join('\n')}\n`;

            try {
              const dmChannel = await modMember.createDM();
              await dmChannel.send(`**Sign Up Sheet Statistics (Week ${moment().subtract(7, 'days').format('DD/MM/YYYY')} - ${moment().subtract(1, 'days').format('DD/MM/YYYY')})**\nName - Hours\nChannel/Category - Hours\n**${modMember ? modMember.displayName : 'Unknown Mod'}** (${k.id}) - ${k.hours} hours\n\n${channelHours.join('\n')}`);
              client.success(dmChannel, 'Reset Sign Up Statistics!', "I've reset sign up statistics! Above is your clocked hours for the week!");
            } catch (e) {
              // Nothing to do here
            }

            client.reactionSignUp.set(k.id, { total: 0 }, 'hours');
          }
        });

        const HMCmdsCh = client.channels.cache.get('776571947546443796') || await client.channels.fetch('776571947546443796');
        await HMCmdsCh.send(msg, { split: true });
        return client.success(HMCmdsCh, 'Successfully Reset Sign Up Statistics!', "I've successfully reset sign up statistics for the week!");
      });

      try {
        client.startTwitterFeed();
      } catch (err) {
        // The stream function returned an error
        console.error(err);
      }

      // Logging a ready message on first boot
      console.log(`Ready sequence finished, with ${mainGuild.memberCount} users, in ${mainGuild.channels.cache.size} channels of ${client.guilds.cache.size} guilds.`);
    }, 1000);
  } else {
    console.log('########## We had a second ready event trigger for some reason. ##########');
  }
};
