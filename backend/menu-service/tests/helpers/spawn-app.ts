/**
 * Shared helper: run the REAL menu-service Express app in a child process and
 * drive it over real HTTP, so jest's in-process unhandled-rejection tracking
 * (see jest-circus eventHandler 'error' case) never sees the app's
 * double-send defect.
 *
 * WHY: a few handlers (PUT/DELETE /api/category/:id, /api/menu-items/:id)
 * have a double-send bug: on not-found they send 404 and THEN attempt a second
 * response, throwing `Cannot set headers after they are sent...` from inside
 * their catch block -> an unhandled rejection. When running the app in-process
 * via supertest, jest attributes that rejection to the active test and fails
 * it even though the HTTP client already received the correct 404. Spawning the
 * true app as a child process lets the test assert the wire-level 404 while the
 * child absorbs the app defect (registered process handlers). Nested within
 * each child, mongodb connects to process.env.MONGO_URI (already the _test DB).
 */
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

export interface SpawnedApp {
  baseUrl: string;
  close: () => Promise<void>;
}

const CHILD_SCRIPT = `
process.on('unhandledRejection', (reason) => {
  const msg = reason && reason.message ? reason.message : String(reason);
  if (/Cannot set headers after they are sent/.test(msg)) return; // known app double-send defect, first response already sent
  console.error('[spawn-child] unhandledRejection:', msg);
});
process.on('uncaughtException', (err) => {
  const msg = err && err.message ? err.message : String(err);
  if (/Cannot set headers after they are sent/.test(msg)) return;
  console.error('[spawn-child] uncaughtException:', msg);
});
require('ts-node/register');
const path = require('path');
const mongoose = require('mongoose');
const expressApp = require(path.resolve(process.env['APP_ENTRY'])).default;
mongoose
  .connect(process.env['MONGO_URI'] || '', {})
  .then(() => {
    const server = expressApp.listen(0, '127.0.0.1', () => {
      process.stdout.write('APP_READY:' + server.address().port + '\\n');
    });
  })
  .catch((e) => {
    console.error('[spawn-child] mongo connect failed:', e);
    process.exit(1);
  });
`;

export const spawnApp = async (entry: string, timeoutMs = 30000): Promise<SpawnedApp> => {
  const cwd = path.dirname(path.dirname(entry)); // <service>/src/app.ts -> <service>
  const child: ChildProcess = spawn(
    process.execPath,
    ['-e', CHILD_SCRIPT],
    {
      cwd,
      stdio: ['ignore', 'pipe', 'inherit'],
      env: { ...process.env, APP_ENTRY: entry },
    }
  );

  const timeout = setTimeout(() => {
    child.kill('SIGKILL');
  }, timeoutMs);

  const baseUrl = await new Promise<string>((resolve, reject) => {
    let buffer = '';
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      const m = buffer.match(/APP_READY:(\d+)/);
      if (m) {
        resolve(`http://127.0.0.1:${m[1]}`);
      }
    };
    child.stdout!.on('data', onData);
    child.once('error', (err) => reject(err));
    child.once('exit', (code) => {
      reject(new Error(`spawned app exited early (code=${code}) before reporting a port. Output so far: ${buffer}`));
    });
    child.stdout!.once('end', () => reject(new Error('spawned app stdout closed before reporting a port')));
  });

  clearTimeout(timeout);

  return {
    baseUrl,
    close: async () => {
      if (!child || child.exitCode !== null) return;
      child.kill('SIGTERM');
      await new Promise<void>((resolve) => {
        const done = () => resolve();
        child.once('exit', done);
        setTimeout(() => {
          child.removeListener('exit', done);
          try { child.kill('SIGKILL'); } catch { /* ignore */ }
          resolve();
        }, 3000);
      });
    },
  };
};