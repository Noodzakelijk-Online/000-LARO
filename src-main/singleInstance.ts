export interface SingleInstanceApplication {
  requestSingleInstanceLock(additionalData?: Record<string, unknown>): boolean;
  quit(): void;
  on(event: 'second-instance', listener: () => void): unknown;
}

export interface FocusableMainWindow {
  isDestroyed(): boolean;
  isMinimized(): boolean;
  restore(): void;
  isVisible(): boolean;
  show(): void;
  focus(): void;
}

/**
 * Prevents concurrent desktop processes from sharing LARO's SQLite profile.
 * A later launch hands attention back to the window owned by the first process.
 */
export function acquireSingleInstanceLock(
  application: SingleInstanceApplication,
  getMainWindow: () => FocusableMainWindow | null,
): boolean {
  if (!application.requestSingleInstanceLock()) {
    application.quit();
    return false;
  }

  application.on('second-instance', () => {
    const window = getMainWindow();
    if (!window || window.isDestroyed()) return;
    if (window.isMinimized()) window.restore();
    if (!window.isVisible()) window.show();
    window.focus();
  });

  return true;
}
