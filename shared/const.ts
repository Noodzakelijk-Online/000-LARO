export const COOKIE_NAME = "laro_session";
export const UNAUTHED_ERR_MSG = "UNAUTHORIZED";
export const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
/** Phase 007: session lifetime. Shortened from 365d to bound the stolen-token window. */
export const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_EXPIRES_IN = "30d";
export const getLoginUrl = () => "/login";

export const APP_TITLE = "LARO";

/**
 * Same mark as the live Manus deployment (favicon + sidebar).
 * @see https://lawyerdashboard.manus.space/
 */
export const APP_LOGO =
  "https://files.manuscdn.com/user_upload_by_module/web_dev_logo/90835377/qYsNgVMIHKMYsBVw.png";