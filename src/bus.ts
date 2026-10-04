// Tiny typed event bus. This is the ONLY contract between the UI layer (src/ui/**)
// and the 3D physics world (src/world/**). Neither side imports the other.

export type SpawnKind =
  | 'frog'
  | 'toucan'
  | 'sloth'
  | 'capybara'
  | 'monkey'
  | 'leaf'
  | 'banana'
  | 'cookie'
  | 'molecule'; // a 3D ball-and-stick dopamine molecule

export type GravityMode = 'normal' | 'moon' | 'sideways' | 'upside-down' | 'emotional';

export type TrackId =
  | 'gentle-rain'
  | 'frog-choir'
  | 'toucan-airstrike'
  | 'sloth-asmr'
  | 'monkey-meeting'
  | 'thunder'
  | 'leaf-4h'
  | 'dopamine-reset';

export interface Events {
  // ---------- UI -> world ----------
  /** First user gesture. World starts the AudioContext + ambience. */
  'audio:unlock': void;
  'spawn': { kind: SpawnKind; count?: number };
  'track:play': { id: TrackId };
  'track:pause': void;
  /** Big red button. World explodes everything upward, then dopamine goes to 0. */
  'dopamine:reset': void;
  /** "Caring is cool again" toggle. When on, every creature slowly turns away & ignores you. */
  'nonchalant': { on: boolean };
  'gravity': { mode: GravityMode };
  'mute': { muted: boolean };
  /** 0..1 master volume (the UI calls this knob "Wetness"). */
  'volume': { value: number };
  /** Screen px covered by UI panels, so the camera can frame the frogs in the part you can actually see. */
  'insets': { top: number; right: number; bottom: number; left: number };

  // ---------- world -> UI ----------
  /** Emitted ~10x/sec. 0..999 (percent). Driven by total kinetic energy of the scene. */
  'dopamine': { value: number };
  /** The 3D tweet card gets a like every time something smacks into it. */
  'likes': { count: number };
  /** Closed captions for sound effects, e.g. "[frog making direct eye contact]". */
  'caption': { text: string };
  /** Emitted ~2x/sec. */
  'stats': { bodies: number; fps: number };
  /** Current track progress, emitted ~4x/sec while a track plays. */
  'track:progress': { id: TrackId; elapsed: number; duration: number };
  /** World auto-advanced or finished a track. */
  'track:ended': { id: TrackId };
  /** Physics + renderer are up. */
  'ready': void;
}

type Handler<T> = T extends void ? () => void : (payload: T) => void;

export class Bus {
  private handlers = new Map<keyof Events, Set<(p: unknown) => void>>();

  on<K extends keyof Events>(type: K, fn: Handler<Events[K]>): () => void {
    let set = this.handlers.get(type);
    if (!set) this.handlers.set(type, (set = new Set()));
    set.add(fn as (p: unknown) => void);
    return () => set!.delete(fn as (p: unknown) => void);
  }

  emit<K extends keyof Events>(type: K, ...payload: Events[K] extends void ? [] : [Events[K]]): void {
    this.handlers.get(type)?.forEach((fn) => fn(payload[0]));
  }
}
