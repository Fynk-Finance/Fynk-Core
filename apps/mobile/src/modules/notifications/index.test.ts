// Public API of the module and the "no server push" criterion of SCRUM-70.
import { NotificationsScreen, notificationsPort, routes, useUnreadCount } from './index';

// Node's fs and path, typed here because the app has no Node types (same as tokens.test.ts).
declare const __dirname: string;
const { readdirSync, readFileSync, statSync } = jest.requireActual<{
  readdirSync(path: string): string[];
  readFileSync(path: string, encoding: string): string;
  statSync(path: string): { isDirectory(): boolean };
}>('fs');
const { join } = jest.requireActual<{ join(...parts: string[]): string }>('path');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('notifications module', () => {
  it('exports the port, the screen, the bell hook and the inbox route', () => {
    expect(typeof notificationsPort.notify).toBe('function');
    expect(typeof notificationsPort.schedule).toBe('function');
    expect(typeof notificationsPort.cancel).toBe('function');
    expect(typeof notificationsPort.isEnabled).toBe('function');
    expect(typeof NotificationsScreen).toBe('function');
    expect(typeof useUnreadCount).toBe('function');
    expect(routes.screens?.map((s) => [s.name, s.path])).toEqual([
      ['notifications.Inbox', 'notificaciones'],
    ]);
  });

  it('never asks for a push token or registers with a push service', () => {
    const forbidden = /PushToken|getExpoPushToken|getDevicePushToken|registerForPush|exp\.host/;
    const offenders = sourceFiles(__dirname).filter((file) =>
      forbidden.test(readFileSync(file, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});
