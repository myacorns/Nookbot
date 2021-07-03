// eslint-disable-next-line no-unused-vars
module.exports = (client, event, shardID) => {
  // The bot won't attempt to login again, so attempt to login again
  console.error('Bot Disconnected! Attempting to reconnect!');
  client.login(client.process.env_token).catch(() => {
    const interval = setInterval(() => {
      client.login(client.process.env_token).then(clearInterval(interval));
    }, 5000);
  });
};
