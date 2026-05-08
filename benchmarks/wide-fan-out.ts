import { add, complete, cycle, save, suite } from 'benny';
import { atom, createStore } from 'jotai';

import { consoleFormatter } from '../dist/formatters/console.js';
import { createLoggedStore } from '../dist/vanilla/create-logged-store.js';

/**
 * Taken from Jotai benchmarks : [wide-fan-out.ts](https://github.com/pmndrs/jotai/blob/main/benchmarks/wide-fan-out.ts).
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
    'wide-fan-out',
    ...[100, 500, 1000]
      .map((width) => [
        add(`1→${width} derived`, () => {
          return () => {
            const store = createStore();
            const base = atom(0);
            const derived = [];
            for (let i = 0; i < width; i++) {
              derived.push(atom((get) => get(base) + i));
            }
            const unsubs = derived.map((d) => store.sub(d, () => {}));
            store.set(base, 1);
            unsubs.forEach((u) => {
              u();
            });
          };
        }),
        add(`1→${width} derived [with logger]`, () => {
          return () => {
            const store = createLoggedStore(createStore(), {
              synchronous: true,
              formatter: () => {},
            });
            const base = atom(0);
            const derived = [];
            for (let i = 0; i < width; i++) {
              derived.push(atom((get) => get(base) + i));
            }
            const unsubs = derived.map((d) => store.sub(d, () => {}));
            store.set(base, 1);
            unsubs.forEach((u) => {
              u();
            });
          };
        }),
        add(`1→${width} derived [with console formatter]`, () => {
          return () => {
            const store = createLoggedStore(createStore(), {
              synchronous: true,
              formatter: consoleFormatter({ logger: silentLogger }),
            });
            const base = atom(0);
            const derived = [];
            for (let i = 0; i < width; i++) {
              derived.push(atom((get) => get(base) + i));
            }
            const unsubs = derived.map((d) => store.sub(d, () => {}));
            store.set(base, 1);
            unsubs.forEach((u) => {
              u();
            });
          };
        }),
      ])
      .flat(1),
    cycle(),
    complete(),
    save({
      folder: import.meta.dirname,
      file: 'wide-fan-out',
      format: 'json',
    }),
    save({
      folder: import.meta.dirname,
      file: 'wide-fan-out',
      format: 'chart.html',
    }),
  );
};

void main();
