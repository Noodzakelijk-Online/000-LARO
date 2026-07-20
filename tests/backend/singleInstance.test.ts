import { describe, expect, it, vi } from 'vitest';
import {
  acquireSingleInstanceLock,
  type FocusableMainWindow,
  type SingleInstanceApplication,
} from '../../src-main/singleInstance';

function buildApplication(acquired: boolean) {
  let secondInstance: (() => void) | undefined;
  const application: SingleInstanceApplication = {
    requestSingleInstanceLock: vi.fn(() => acquired),
    quit: vi.fn(),
    on: vi.fn((event, listener) => {
      if (event === 'second-instance') secondInstance = listener;
    }),
  };
  return { application, triggerSecondInstance: () => secondInstance?.() };
}

function buildWindow(overrides: Partial<FocusableMainWindow> = {}): FocusableMainWindow {
  return {
    isDestroyed: vi.fn(() => false),
    isMinimized: vi.fn(() => false),
    restore: vi.fn(),
    isVisible: vi.fn(() => true),
    show: vi.fn(),
    focus: vi.fn(),
    ...overrides,
  };
}

describe('desktop single-instance lifecycle', () => {
  it('quits a later process before it can initialize the shared profile', () => {
    const { application } = buildApplication(false);

    expect(acquireSingleInstanceLock(application, () => null)).toBe(false);
    expect(application.requestSingleInstanceLock).toHaveBeenCalledOnce();
    expect(application.quit).toHaveBeenCalledOnce();
    expect(application.on).not.toHaveBeenCalled();
  });

  it('restores, shows, and focuses the primary window after a second launch', () => {
    const { application, triggerSecondInstance } = buildApplication(true);
    const window = buildWindow({
      isMinimized: vi.fn(() => true),
      isVisible: vi.fn(() => false),
    });

    expect(acquireSingleInstanceLock(application, () => window)).toBe(true);
    triggerSecondInstance();

    expect(window.restore).toHaveBeenCalledOnce();
    expect(window.show).toHaveBeenCalledOnce();
    expect(window.focus).toHaveBeenCalledOnce();
  });

  it('ignores a second-launch event until a usable main window exists', () => {
    const { application, triggerSecondInstance } = buildApplication(true);
    const window = buildWindow({ isDestroyed: vi.fn(() => true) });

    acquireSingleInstanceLock(application, () => window);
    triggerSecondInstance();

    expect(window.restore).not.toHaveBeenCalled();
    expect(window.show).not.toHaveBeenCalled();
    expect(window.focus).not.toHaveBeenCalled();
  });
});
