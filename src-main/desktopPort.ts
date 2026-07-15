/**
 * Preserve a registered loopback OAuth callback port when one is configured.
 * Without an explicit callback, port zero lets the OS select a free port.
 */
export function resolveDesktopServerPort(redirectBase: string | undefined): number {
  if (!redirectBase) return 0;
  try {
    const url = new URL(redirectBase);
    const hostname = url.hostname.toLowerCase();
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(hostname) || !url.port) return 0;
    const port = Number(url.port);
    return Number.isInteger(port) && port > 0 && port <= 65_535 ? port : 0;
  } catch {
    return 0;
  }
}

/**
 * A packaged executable must never inherit development-only renderer behavior
 * from the launching shell. In particular, NODE_ENV=development must not make
 * a release build try to load the Vite server or expose development menus.
 */
export function isDesktopDevelopmentMode(
  isPackaged: boolean,
  nodeEnv: string | undefined
): boolean {
  return !isPackaged && nodeEnv === 'development';
}
