import { atom, createStore } from 'jotai';

import { bindAtomsLoggerToStore } from '../dist/bind-atoms-logger-to-store.js';

const ITERATIONS = 10_000;

console.log(`running ${ITERATIONS} iterations...`);

const store = createStore();

bindAtomsLoggerToStore(store, {
  synchronous: true,
  logger: { log: () => {}, group: () => {}, groupEnd: () => {} },
});

const unsubscribes: (() => void)[] = [];

for (let i = 0; i < ITERATIONS; ++i) {
  const a = atom(i);
  store.get(a);
  unsubscribes.push(
    store.sub(a, () => {
      store.get(a);
    }),
  );
  store.set(a, (c) => c + 1);
}

for (const unsubscribe of unsubscribes) {
  unsubscribe();
}

console.log('done');
