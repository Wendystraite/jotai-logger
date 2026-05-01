import { type WritableAtom, atom } from 'jotai';
import { INTERNAL_isActuallyWritableAtom } from 'jotai/vanilla/internals';

import type { AnyAtom } from '../types/atoms-logger.js';

const noopAtom = atom();
noopAtom.debugPrivate = true;
const defaultAtomWrite = noopAtom.write as WritableAtom<unknown, unknown[], unknown>['write'];

/**
 * Check if the atom is a writeable atom with a custom write method.
 */
export function hasAtomCustomWriteMethod(atom: AnyAtom): boolean {
  return INTERNAL_isActuallyWritableAtom(atom) && atom.write !== defaultAtomWrite;
}
