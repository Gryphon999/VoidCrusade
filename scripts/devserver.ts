/**
 * Dev server for the script tools. The server runs without a file watcher, so one left over from
 * an earlier run would keep serving the code as it was then: `startServer` refuses a port that
 * already answers, and `stopServer` stops the whole npx → vite process tree (also on Windows).
 */
import { ChildProcess, spawn, spawnSync } from 'node:child_process';

async function answers(url: string): Promise<boolean> {
  try {
    return (await fetch(url)).ok;
  } catch {
    return false;
  }
}

export async function startServer(port: number): Promise<{ server: ChildProcess; url: string }> {
  const url = `http://localhost:${port}/`;
  if (await answers(url)) throw new Error(`Port ${port} is already serving: stop the old dev server first (it would serve stale code).`);
  const server = spawn('npx', ['vite', '--port', String(port), '--strictPort'], { stdio: 'ignore', shell: process.platform === 'win32', detached: process.platform !== 'win32', env: { ...process.env, VC_STATIC: '1' } });
  for (let i = 0; i < 120; i++) {
    if (await answers(url)) return { server, url };
    await new Promise((r) => setTimeout(r, 500));
  }
  stopServer(server);
  throw new Error('dev server did not start');
}

export function stopServer(server: ChildProcess): void {
  if (!server.pid) return;
  try {
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F']);
    else process.kill(-server.pid);
  } catch {
    server.kill();
  }
}
