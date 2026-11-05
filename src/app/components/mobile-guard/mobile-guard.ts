import { DestroyRef, Component, inject, signal } from '@angular/core';

const NOTICE_KEY = 'gly-quest-story/mobile-notice';

/** Téléphone : écran tactile dont le petit côté est celui d'un téléphone (les tablettes passent). */
const PHONE_QUERY =
  '(pointer: coarse) and (max-width: 600px), (pointer: coarse) and (max-height: 600px)';

/** Verrouillage d'orientation (absent des types DOM de TypeScript). */
type LockableOrientation = ScreenOrientation & { lock?: (o: 'landscape') => Promise<void> };

/**
 * Sur téléphone : demande de tourner l'appareil en paysage quand il est en portrait,
 * et prévient une fois par visite que le jeu est pensé pour un ordinateur.
 *
 * Le web ne permet pas d'imposer le paysage partout : `screen.orientation.lock` ne marche
 * qu'en plein écran, et pas sur iPhone. Le bouton « Plein écran » le tente quand c'est possible.
 */
@Component({
  selector: 'app-mobile-guard',
  templateUrl: './mobile-guard.html',
  styleUrl: './mobile-guard.scss',
})
export class MobileGuard {
  private readonly phoneQuery = query(PHONE_QUERY);
  private readonly portraitQuery = query('(orientation: portrait)');

  protected readonly isPhone = signal(this.phoneQuery.matches);
  protected readonly isPortrait = signal(this.portraitQuery.matches);
  protected readonly showNotice = signal(this.phoneQuery.matches && !readNoticeSeen());
  protected readonly canFullscreen = !!document.fullscreenEnabled;

  constructor() {
    const onPhone = () => this.isPhone.set(this.phoneQuery.matches);
    const onPortrait = () => this.isPortrait.set(this.portraitQuery.matches);
    this.phoneQuery.addEventListener('change', onPhone);
    this.portraitQuery.addEventListener('change', onPortrait);
    inject(DestroyRef).onDestroy(() => {
      this.phoneQuery.removeEventListener('change', onPhone);
      this.portraitQuery.removeEventListener('change', onPortrait);
    });
  }

  protected dismiss(): void {
    this.showNotice.set(false);
    try {
      sessionStorage.setItem(NOTICE_KEY, '1');
    } catch {
      // stockage indisponible (navigation privée…) : le message reviendra, tant pis
    }
  }

  /** Plein écran puis verrouillage en paysage (Android surtout ; ignoré là où ce n'est pas permis). */
  protected async fullscreen(): Promise<void> {
    this.dismiss();
    try {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      await (screen.orientation as LockableOrientation).lock?.('landscape');
    } catch {
      // refusé par le navigateur : le message « tourne ton téléphone » reste le recours
    }
  }
}

/** `matchMedia`, ou une requête qui ne correspond jamais là où il n'existe pas (tests). */
function query(media: string): MediaQueryList {
  return typeof matchMedia === 'function'
    ? matchMedia(media)
    : ({
        matches: false,
        addEventListener() {},
        removeEventListener() {},
      } as unknown as MediaQueryList);
}

function readNoticeSeen(): boolean {
  try {
    return sessionStorage.getItem(NOTICE_KEY) === '1';
  } catch {
    return false;
  }
}
