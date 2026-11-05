import { Media } from '../models/game.models';

const VIDEO_EXTENSIONS = /\.(mp4|webm|ogv|m4v|mov)$/i;

/** Le chemin désigne-t-il une vidéo (d'après son extension) ? */
export function isVideo(path: string): boolean {
  return VIDEO_EXTENSIONS.test(path.split(/[?#]/)[0]);
}

/** Chemins d'un média, dans l'ordre de lecture (vide si absent ou `""`). */
export function mediaList(media: Media | null | undefined): string[] {
  if (!media) return [];
  return (Array.isArray(media) ? media : [media]).filter((path) => !!path);
}
