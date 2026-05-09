import { add, complete, cycle, save, suite } from 'benny';
import type { Atom } from 'jotai';
import { atom, createStore } from 'jotai';

import { consoleFormatter } from '../dist/formatters/console.js';
import { createLoggedStore } from '../dist/vanilla/create-logged-store.js';

/**
 * Taken from Jotai benchmarks : [diamond.ts](https://github.com/pmndrs/jotai/blob/main/benchmarks/diamond.ts).
 */

const silentLogger = {
  log: () => {},
  group: () => {},
  groupCollapsed: () => {},
  groupEnd: () => {},
  warn: () => {},
};

const main = async () => {
  await suite(
    'diamond',
    ...[10, 50, 100, 200]
      .map((midCount) => [
        add(`base→${midCount} mid→leaf`, () => {
          return () => {
            const store = createStore();
            const base = atom(0);
            const mid: Atom<number>[] = [];
            for (let i = 0; i < midCount; i++) {
              mid.push(atom((get) => get(base) + i));
            }
            const leaf = atom((get) => {
              let sum = 0;
              for (const m of mid) sum += get(m);
              return sum;
            });
            const unsub = store.sub(leaf, () => {});
            store.set(base, 1);
            unsub();
          };
        }),
        add(`base→${midCount} mid→leaf [with logger]`, () => {
          return () => {
            const store = createLoggedStore(createStore(), {
              synchronous: true,
              formatter: () => {},
            });
            const base = atom(0);
            const mid: Atom<number>[] = [];
            for (let i = 0; i < midCount; i++) {
              mid.push(atom((get) => get(base) + i));
            }
            const leaf = atom((get) => {
              let sum = 0;
              for (const m of mid) sum += get(m);
              return sum;
            });
            const unsub = store.sub(leaf, () => {});
            store.set(base, 1);
            unsub();
          };
        }),
        add(`base→${midCount} mid→leaf [with console formatter]`, () => {
          return () => {
            const store = createLoggedStore(createStore(), {
              synchronous: true,
              formatter: consoleFormatter({ logger: silentLogger }),
            });
            const base = atom(0);
            const mid: Atom<number>[] = [];
            for (let i = 0; i < midCount; i++) {
              mid.push(atom((get) => get(base) + i));
            }
            const leaf = atom((get) => {
              let sum = 0;
              for (const m of mid) sum += get(m);
              return sum;
            });
            const unsub = store.sub(leaf, () => {});
            store.set(base, 1);
            unsub();
          };
        }),
      ])
      .flat(1),
    cycle(),
    complete(),
    save({
      folder: import.meta.dirname,
      file: 'diamond',
      format: 'json',
    }),
    save({
      folder: import.meta.dirname,
      file: 'diamond',
      format: 'chart.html',
    }),
  );
};

void main();
