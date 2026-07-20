import { describe, expect, it, vi } from 'vitest';
import {
  installDenyByDefaultPermissions,
  type PermissionSession,
} from '../../src-main/sessionPermissions';

function buildSession() {
  let checkHandler: ((...args: unknown[]) => boolean) | undefined;
  let requestHandler: ((...args: unknown[]) => void) | undefined;
  const targetSession = {
    setPermissionCheckHandler: vi.fn((handler) => {
      checkHandler = handler;
    }),
    setPermissionRequestHandler: vi.fn((handler) => {
      requestHandler = handler;
    }),
  } as unknown as PermissionSession;
  return {
    targetSession,
    getCheckHandler: () => checkHandler,
    getRequestHandler: () => requestHandler,
  };
}

describe('Electron session permission policy', () => {
  it('installs both permission handlers', () => {
    const { targetSession } = buildSession();

    installDenyByDefaultPermissions(targetSession);

    expect(targetSession.setPermissionCheckHandler).toHaveBeenCalledOnce();
    expect(targetSession.setPermissionRequestHandler).toHaveBeenCalledOnce();
  });

  it.each(['media', 'geolocation', 'clipboard-read', 'notifications', 'fileSystem'])(
    'denies a %s permission check',
    (permission) => {
      const { targetSession, getCheckHandler } = buildSession();
      installDenyByDefaultPermissions(targetSession);

      expect(getCheckHandler()?.(null, permission, 'http://127.0.0.1')).toBe(false);
    },
  );

  it.each(['media', 'display-capture', 'openExternal', 'storage-access', 'unknown'])(
    'rejects a %s permission request',
    (permission) => {
      const { targetSession, getRequestHandler } = buildSession();
      const callback = vi.fn();
      installDenyByDefaultPermissions(targetSession);

      getRequestHandler()?.({}, permission, callback, {});

      expect(callback).toHaveBeenCalledOnce();
      expect(callback).toHaveBeenCalledWith(false);
    },
  );
});
