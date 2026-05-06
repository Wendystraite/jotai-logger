import type { AnyAtom, AtomId } from '../types/event.js';
import type { AtomLoggerStoreState } from '../types/store.js';

export function shouldShowAtom(loggerState: AtomLoggerStoreState, atom: AnyAtom | AtomId): boolean {
  if (!loggerState.enabled) {
    return false;
  }
  if (typeof atom === 'string') {
    return true;
  }
  if (!loggerState.shouldShowPrivateAtoms && atom.debugPrivate === true) {
    return false;
  }
  if (loggerState.shouldShowAtom) {
    return loggerState.shouldShowAtom(atom);
  }
  return true;
}
