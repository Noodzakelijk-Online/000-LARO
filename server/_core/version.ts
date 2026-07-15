/** Application version shared by health, system, and administration surfaces. */
export const APP_VERSION =
  process.env.LARO_APP_VERSION || process.env.npm_package_version || 'unknown';
