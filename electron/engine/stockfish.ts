import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { EventEmitter } from 'node:events';
import path from 'node:path';

export type StockfishOptions = {
  /** Absolute path to the Stockfish binary. If omitted, the default location
   *  produced by `scripts/fetch-stockfish.{sh,ps1}` is used (resolved against
   *  `appRoot`). */
  binaryPath?: string;
  /** Project root used to resolve the default `stockfish/bin/...` path. The
   *  Electron main process should pass `app.getAppPath()`. Tests can pass
   *  `process.cwd()`. Required when `binaryPath` is not given. */
  appRoot?: string;
  /** Timeout (ms) for any single UCI request/response round-trip. */
  timeoutMs?: number;
};

export type StockfishEvents = {
  line: (line: string) => void;
  stderr: (chunk: string) => void;
  exit: (code: number | null) => void;
  error: (err: Error) => void;
};

/**
 * Resolve the default Stockfish binary path produced by the fetch scripts.
 * Layout: `<appRoot>/stockfish/bin/<platform>-<arch>/stockfish[.exe]`.
 */
export function defaultStockfishPath(appRoot: string): string {
  const exe = process.platform === 'win32' ? 'stockfish.exe' : 'stockfish';
  const dir = `${process.platform}-${process.arch}`;
  return path.join(appRoot, 'stockfish', 'bin', dir, exe);
}

/**
 * Thin UCI wrapper around a Stockfish subprocess. This module is responsible
 * only for process lifecycle and the initial handshake — analysis logic
 * (`go`, `info`, `bestmove` parsing) lives in `analyze.ts` (Phase 1 / Task 3).
 */
export class StockfishEngine extends EventEmitter {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private stdoutBuffer = '';
  private readonly timeoutMs: number;
  private readonly binaryPath: string;

  constructor(opts: StockfishOptions) {
    super();
    if (opts.binaryPath) {
      this.binaryPath = opts.binaryPath;
    } else if (opts.appRoot) {
      this.binaryPath = defaultStockfishPath(opts.appRoot);
    } else {
      throw new Error(
        'StockfishEngine: either `binaryPath` or `appRoot` must be provided.',
      );
    }
    this.timeoutMs = opts.timeoutMs ?? 5000;
  }

  /** Spawn the process and complete the UCI handshake. */
  async start(): Promise<void> {
    if (this.proc) {
      throw new Error('Stockfish process already running.');
    }

    const proc = spawn(this.binaryPath, [], { stdio: 'pipe' });
    this.proc = proc;

    proc.stdout.setEncoding('utf8');
    proc.stdout.on('data', (chunk: string) => this.handleStdout(chunk));

    proc.stderr.setEncoding('utf8');
    proc.stderr.on('data', (chunk: string) => this.emit('stderr', chunk));

    proc.on('exit', (code) => {
      this.proc = null;
      this.emit('exit', code);
    });
    proc.on('error', (err) => this.emit('error', err));

    await this.handshake();
  }

  /** Send a single UCI command (newline appended). */
  send(command: string): void {
    if (!this.proc?.stdin.writable) {
      throw new Error('Stockfish process is not running.');
    }
    this.proc.stdin.write(`${command}\n`);
  }

  /** Send `quit` and wait for the process to exit (force-killed after 1s). */
  async quit(): Promise<void> {
    const proc = this.proc;
    if (!proc) return;
    try {
      proc.stdin.write('quit\n');
    } catch {
      // stdin may already be closed; fall through to the exit wait.
    }
    await new Promise<void>((resolve) => {
      const force = setTimeout(() => {
        if (!proc.killed) proc.kill('SIGKILL');
      }, 1000);
      proc.once('exit', () => {
        clearTimeout(force);
        resolve();
      });
    });
    this.proc = null;
  }

  /** True between a successful `start()` and process exit. */
  isRunning(): boolean {
    return this.proc !== null;
  }

  private async handshake(): Promise<void> {
    await this.sendAndWait('uci', (line) => line.trim() === 'uciok');
    await this.sendAndWait('isready', (line) => line.trim() === 'readyok');
    this.send('ucinewgame');
    await this.sendAndWait('isready', (line) => line.trim() === 'readyok');
  }

  /**
   * Send a command and resolve once a stdout line satisfies `match`. Rejects
   * if `timeoutMs` elapses or the process exits first.
   */
  private sendAndWait(
    command: string,
    match: (line: string) => boolean,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const onLine = (line: string): void => {
        if (match(line)) {
          cleanup();
          resolve();
        }
      };
      const onExit = (code: number | null): void => {
        cleanup();
        reject(
          new Error(
            `Stockfish exited (code=${code}) while waiting for response to '${command}'.`,
          ),
        );
      };
      const cleanup = (): void => {
        clearTimeout(timer);
        this.off('line', onLine);
        this.off('exit', onExit);
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(
          new Error(
            `Timed out after ${this.timeoutMs}ms waiting for response to '${command}'.`,
          ),
        );
      }, this.timeoutMs);

      this.on('line', onLine);
      this.once('exit', onExit);
      this.send(command);
    });
  }

  private handleStdout(chunk: string): void {
    this.stdoutBuffer += chunk;
    let newlineIdx = this.stdoutBuffer.indexOf('\n');
    while (newlineIdx !== -1) {
      const rawLine = this.stdoutBuffer.slice(0, newlineIdx);
      this.stdoutBuffer = this.stdoutBuffer.slice(newlineIdx + 1);
      const line = rawLine.replace(/\r$/, '');
      if (line.length > 0) {
        this.emit('line', line);
      }
      newlineIdx = this.stdoutBuffer.indexOf('\n');
    }
  }
}
