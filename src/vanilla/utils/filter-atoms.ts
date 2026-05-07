import type { AnyAtom } from '../types/event.js';
import type { AtomLoggerStoreState } from '../types/store.js';
import { shouldShowAtom } from './should-show-atom.js';

export function filterAtoms(
  atoms: Set<AnyAtom> | undefined,
  loggerState: AtomLoggerStoreState,
): Set<AnyAtom> | undefined {
  if (!atoms) {
    return undefined;
  }
  const result = new Set<AnyAtom>();
  for (const atom of atoms) {
    if (shouldShowAtom(loggerState, atom)) {
      result.add(atom);
    }
  }
  return result;
}
