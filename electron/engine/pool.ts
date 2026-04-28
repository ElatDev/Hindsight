/**
 * Engine pool — runs N Stockfish processes in parallel so a game review's
 * per-move analyses can run concurrently instead of serialized through a
 * single subprocess. Each engine still serializes its own commands (UCI
 * `bestmove` output is shared across an engine's stdin/stdout pair, so
 * concurrent `go` calls on the *same* engine would race), but we have N
 * engines, so review throughput scales N-fold.
 *
 * The pool exposes a single `dispatch(fn)` method. The caller hands over a
 * task that takes a Stockfish engine and returns a Promise; the pool picks
 * the next free engine, runs the task on it, and resolves with the result.
 * Tasks queue when every engine is busy.
 *
 * Engines spawn lazily on first use, so the pool's `start()` cost is only
 * paid for the parallelism the caller actually needs.
 */

import { StockfishEngine, type StockfishOptions } from './stockfish';

type Waiter<T> = {
  task: (engine: StockfishEngine) => Promise<T>;
  resolve: (value: T) => void;
  reject: (err: unknown) => void;
};

type EngineSlot = {
  engine: StockfishEngine | null;
  starting: Promise<StockfishEngine> | null;
  busy: boolean;
};

export type EnginePoolOptions = StockfishOptions & {
  /** Number of Stockfish processes to keep available. Defaults to 4 — the
   *  pragmatic sweet spot on a 4-core+ machine where each engine runs
   *  single-threaded. Reduce if memory pressure matters; increase only if
   *  you've measured the bottleneck shifting to inter-engine wait. */
  size?: number;
};

export class EnginePool {
  private readonly slots: EngineSlot[];
  private readonly factory: () => StockfishEngine;
  // FIFO queue of tasks waiting for a free engine. Typed as `unknown` so
  // the `dispatch` generic can resolve with any return type.
  private readonly waiters: Waiter<unknown>[] = [];

  constructor(options: EnginePoolOptions) {
    const size = Math.max(1, options.size ?? 4);
    this.slots = Array.from({ length: size }, () => ({
      engine: null,
      starting: null,
      busy: false,
    }));
    this.factory = (): StockfishEngine => new StockfishEngine(options);
  }

  /** Number of engines the pool was sized for. Engines beyond the first
   *  spin up lazily as load arrives; this number is the cap. */
  get size(): number {
    return this.slots.length;
  }

  /**
   * Hand over a task that needs a Stockfish engine. The pool routes it to
   * the next idle engine (or the next one to free up). The task is
   * responsible for setting any UCI options it needs before searching —
   * the same engine instance is shared across many calls, so options
   * leak between tasks if a task forgets to reset them. The IPC handlers
   * that consume this method always set the options they care about
   * explicitly.
   */
  async dispatch<T>(task: (engine: StockfishEngine) => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.waiters.push({
        task: task as (engine: StockfishEngine) => Promise<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      void this.tryAssign();
    });
  }

  /** Quit every started engine. Errors during quit are swallowed — the
   *  process is exiting anyway, and a stuck engine just gets SIGKILL'd
   *  by the OS during shutdown. */
  async quit(): Promise<void> {
    await Promise.all(
      this.slots.map(async (slot) => {
        const engine = slot.engine;
        slot.engine = null;
        slot.busy = false;
        if (engine) {
          try {
            await engine.quit();
          } catch {
            // best-effort
          }
        }
      }),
    );
  }

  private async tryAssign(): Promise<void> {
    while (this.waiters.length > 0) {
      const slotIdx = this.slots.findIndex(
        (s) => !s.busy && s.starting === null,
      );
      if (slotIdx === -1) return;
      const slot = this.slots[slotIdx];
      const waiter = this.waiters.shift();
      if (!waiter) return;
      slot.busy = true;
      void this.runOnSlot(slot, waiter);
    }
  }

  private async runOnSlot(
    slot: EngineSlot,
    waiter: Waiter<unknown>,
  ): Promise<void> {
    try {
      if (!slot.engine) {
        slot.starting = (async (): Promise<StockfishEngine> => {
          const e = this.factory();
          await e.start();
          return e;
        })();
        slot.engine = await slot.starting;
        slot.starting = null;
      }
      const value = await waiter.task(slot.engine);
      waiter.resolve(value);
    } catch (err) {
      waiter.reject(err);
    } finally {
      slot.busy = false;
      // Drain any waiters that piled up while this slot was busy.
      void this.tryAssign();
    }
  }
}
