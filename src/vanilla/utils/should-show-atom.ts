import type { AnyAtom, AtomId } from '../types/event.js';
import type { AtomLoggerStoreState } from '../types/store.js';

export function shouldShowAtom(loggerState: AtomLoggerStoreState, atom: AnyAtom | AtomId): boolean {
  if (!loggerState.options.enabled) {
    return false;
  }
  if (typeof atom === 'string') {
    return true;
  }
  if (!loggerState.options.shouldShowPrivateAtoms && atom.debugPrivate === true) {
    return false;
  }
  if (loggerState.options.shouldShowAtom) {
    return loggerState.options.shouldShowAtom(atom);
  }
  return true;
}
