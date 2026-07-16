const { build } = require('./package.json');

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} must match the value from Partner Center`);
  }
  return value;
}

module.exports = {
  ...build,
  appx: {
    ...build.appx,
    identityName: requiredEnvironment('STORE_IDENTITY_NAME'),
    publisher: requiredEnvironment('STORE_PUBLISHER'),
    publisherDisplayName: requiredEnvironment('STORE_PUBLISHER_DISPLAY_NAME'),
  },
};
