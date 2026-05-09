import { add, complete, cycle, save, suite } from 'benny';
import type { Atom } from 'jotai';
import { atom, createStore } from 'jotai';

import { consoleFormatter } from '../dist/formatters/console.js';
import { createLoggedStore } from '../dist/vanilla/create-logged-store.js';

/**
 * Taken from Jotai benchmarks : [derived-chain.ts](https://github.com/pmndrs/jotai/blob/main/benchmarks/derived-chain.ts).
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
    'derived-chain',
    ...[10, 50, 100, 200]
      .map((depth) => [
        add(`depth=${depth}`, () => {
          return () => {
            const store = createStore();
            const base = atom(0);
            let prev: Atom<number> = base;
            for (let i = 0; i < depth; i++) {
              const p = prev;
              prev = atom((get) => get(p) + 1);
            }
            const leaf = prev;
            const unsub = store.sub(leaf, () => {});
            store.set(base, 1);
            unsub();
          };
        }),
        add(`depth=${depth} [with logger]`, () => {
          return () => {
            const store = createLoggedStore(createStore(), {
              synchronous: true,
              formatter: () => {},
            });
            const base = atom(0);
            let prev: Atom<number> = base;
            for (let i = 0; i < depth; i++) {
              const p = prev;
              prev = atom((get) => get(p) + 1);
            }
            const leaf = prev;
            const unsub = store.sub(leaf, () => {});
            store.set(base, 1);
            unsub();
          };
        }),
        add(`depth=${depth} [with console formatter]`, () => {
          return () => {
            const store = createLoggedStore(createStore(), {
              synchronous: true,
              formatter: consoleFormatter({ logger: silentLogger }),
            });
            const base = atom(0);
            let prev: Atom<number> = base;
            for (let i = 0; i < depth; i++) {
              const p = prev;
              prev = atom((get) => get(p) + 1);
            }
            const leaf = prev;
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
      file: 'derived-chain',
      format: 'json',
    }),
    save({
      folder: import.meta.dirname,
      file: 'derived-chain',
      format: 'chart.html',
    }),
  );
};

void main();
