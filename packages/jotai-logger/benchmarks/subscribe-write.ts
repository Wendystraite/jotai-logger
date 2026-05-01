import { add, complete, cycle, save, suite } from 'benny';
import { type PrimitiveAtom, atom, createStore } from 'jotai';

import { bindAtomsLoggerToStore } from '../src/bind-atoms-logger-to-store.js';

/**
 * Taken from Jotai benchmarks : [subscribe-write.ts](https://github.com/pmndrs/jotai/blob/main/benchmarks/subscribe-write.ts).
 */

const cleanupFns = new Set<() => void>();
const cleanup = () => {
  cleanupFns.forEach((fn) => {
    fn();
  });
  cleanupFns.clear();
};

const createStateWithAtoms = (n: number, { withLogger }: { withLogger: boolean }) => {
  let targetAtom: PrimitiveAtom<number> | undefined;
  const store = createStore();
  if (withLogger) {
    bindAtomsLoggerToStore(store, {
      synchronous: true,
      logger: { log: () => {}, group: () => {}, groupEnd: () => {} },
    });
  }
  for (let i = 0; i < n; ++i) {
    const a = atom(i);
    targetAtom ??= a;
    store.get(a);
    const unsub = store.sub(a, () => {
      store.get(a);
    });
    cleanupFns.add(unsub);
  }
  if (!targetAtom) {
    throw new Error();
  }
  return [store, targetAtom] as const;
};

const main = async () => {
  await suite(
    'subscribe-write',
    ...[2, 3, 4, 5]
      .map((n) => [
        add(`atoms=${10 ** n}`, () => {
          cleanup();
          const [store, targetAtom] = createStateWithAtoms(10 ** n, { withLogger: false });
          return () => {
            store.set(targetAtom, (c) => c + 1);
          };
        }),
        add(`atoms=${10 ** n} [with logger]`, () => {
          cleanup();
          const [store, targetAtom] = createStateWithAtoms(10 ** n, { withLogger: true });
          return () => {
            store.set(targetAtom, (c) => c + 1);
          };
        }),
      ])
      .flat(1),
    cycle(),
    complete(),
    save({
      folder: import.meta.dirname,
      file: 'subscribe-write',
      format: 'json',
    }),
    save({
      folder: import.meta.dirname,
      file: 'subscribe-write',
      format: 'chart.html',
    }),
  );
};

void main();
