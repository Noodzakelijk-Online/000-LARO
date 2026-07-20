import type { Session } from 'electron';

export type PermissionSession = Pick<
  Session,
  'setPermissionCheckHandler' | 'setPermissionRequestHandler'
>;

/**
 * LARO uses explicit native IPC for local files and external links. Browser
 * device, clipboard-read, notification, and storage-access permissions are not
 * part of the product surface, so Electron sessions deny them by default.
 */
export function installDenyByDefaultPermissions(targetSession: PermissionSession): void {
  targetSession.setPermissionCheckHandler(() => false);
  targetSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
}
