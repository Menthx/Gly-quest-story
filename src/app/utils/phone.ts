/** Téléphone : écran tactile dont le petit côté est celui d'un téléphone (les tablettes passent). */
export const PHONE_QUERY =
  '(pointer: coarse) and (max-width: 600px), (pointer: coarse) and (max-height: 600px)';

/** `matchMedia`, ou une requête qui ne correspond jamais là où il n'existe pas (tests). */
export function query(media: string): MediaQueryList {
  return typeof matchMedia === 'function'
    ? matchMedia(media)
    : ({
        matches: false,
        addEventListener() {},
        removeEventListener() {},
      } as unknown as MediaQueryList);
}
