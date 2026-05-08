import { add, complete, cycle, save, suite } from 'benny';
import { atom, createStore } from 'jotai';

import { consoleFormatter } from '../dist/formatters/console.js';
import { createLoggedStore } from '../dist/vanilla/create-logged-store.js';

/**
 * Taken from Jotai benchmarks : [atom-creation.ts](https://github.com/pmndrs/jotai/blob/main/benchmarks/atom-creation.ts).
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
    'atom-creation',
    add('create 10k primitive atoms', () => {
      return () => {
        for (let i = 0; i < 10_000; i++) {
          atom(i);
        }
      };
    }),
    add('create 10k derived atoms', () => {
      const base = atom(0);
      return () => {
        for (let i = 0; i < 10_000; i++) {
          atom((get) => get(base) + i);
        }
      };
    }),
    add('set 10k atoms in store', () => {
      return () => {
        const store = createStore();
        for (let i = 0; i < 10_000; i++) {
          store.set(atom(i), i);
        }
      };
    }),
    add('set 10k atoms in store [with logger]', () => {
      return () => {
        const store = createLoggedStore(createStore(), {
          synchronous: true,
          formatter: () => {},
        });
        for (let i = 0; i < 10_000; i++) {
          store.set(atom(i), i);
        }
      };
    }),
    add('set 10k atoms in store [with console formatter]', () => {
      return () => {
        const store = createLoggedStore(createStore(), {
          synchronous: true,
          formatter: consoleFormatter({ logger: silentLogger }),
        });
        for (let i = 0; i < 10_000; i++) {
          store.set(atom(i), i);
        }
      };
    }),
    cycle(),
    complete(),
    save({
      folder: import.meta.dirname,
      file: 'atom-creation',
      format: 'json',
    }),
    save({
      folder: import.meta.dirname,
      file: 'atom-creation',
      format: 'chart.html',
    }),
  );
};

void main();
