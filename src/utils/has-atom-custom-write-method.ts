import { type Atom, type WritableAtom, atom } from 'jotai';
import { INTERNAL_isActuallyWritableAtom } from 'jotai/vanilla/internals';

const noopAtom = atom();
noopAtom.debugPrivate = true;
const defaultAtomWrite = noopAtom.write as WritableAtom<unknown, unknown[], unknown>['write'];

/**
 * Check if the atom is a writeable atom with a custom write method.
 */
export function hasAtomCustomWriteMethod(atom: Atom<unknown>): boolean {
  return INTERNAL_isActuallyWritableAtom(atom) && atom.write !== defaultAtomWrite;
}
