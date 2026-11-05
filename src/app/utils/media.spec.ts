import { isVideo, mediaList } from './media';

describe('media', () => {
  it('reconnaît une vidéo à son extension', () => {
    expect(isVideo('assets/videos/sort.mp4')).toBe(true);
    expect(isVideo('assets/videos/sort.WEBM')).toBe(true);
    expect(isVideo('assets/videos/sort.mp4?v=2')).toBe(true);
    expect(isVideo('assets/backgrounds/train.jpg')).toBe(false);
  });

  it('donne la liste des chemins à lire', () => {
    expect(mediaList(undefined)).toEqual([]);
    expect(mediaList('')).toEqual([]);
    expect(mediaList('a.jpg')).toEqual(['a.jpg']);
    expect(mediaList(['a.mp4', 'b.mp4'])).toEqual(['a.mp4', 'b.mp4']);
  });
});
