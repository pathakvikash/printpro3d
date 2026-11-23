// "What should I add next?" Rules only (no AI key needed): looks at what the design is missing and orders it like a build.
// Drone order: frame (the user's shapes) -> 4 motors -> ESC -> battery -> flight controller -> camera. Payload only when asked for.
import type { Shape } from '../playground.ts';
import type { Parts } from '../flight/layout.ts';
import { classify, type PartKind } from './validate.ts';

export type NextSuggestion = { kind: PartKind; reason: string; count?: number };
export type SuggestContext = { category?: string; payload?: boolean };
export const DRONE_MOTORS = 4;

/** Ordered missing parts. [] when nothing is missing, when there is no frame yet (add a solid shape first) or for a non-drone category. Never lists what exists. */
export function suggestNext(shapes: Shape[], parts: Parts, ctx: SuggestContext = {}): NextSuggestion[] {
  if (ctx.category && ctx.category !== 'drone') return [];
  if (!shapes.some((s) => s.mode === 'solid')) return [];
  const have = new Set(parts.components.map((c) => classify(c.name)));
  const out: NextSuggestion[] = [];
  const missing = DRONE_MOTORS - parts.motors.length;
  if (missing > 0) out.push({ kind: 'motor', count: missing, reason: parts.motors.length ? `Add ${missing} more motor${missing > 1 ? 's' : ''}: a quad needs ${DRONE_MOTORS}, one on each arm.` : `Add ${DRONE_MOTORS} motors, one on each arm: they lift the drone.` });
  if (!have.has('esc')) out.push({ kind: 'esc', count: 1, reason: 'Add an ESC: it turns the battery power into motor speed.' });
  if (!have.has('battery')) out.push({ kind: 'battery', count: 1, reason: 'Add a battery: nothing spins without power, and it is the heaviest part so its position sets the balance.' });
  if (!have.has('fc')) out.push({ kind: 'fc', count: 1, reason: 'Add a flight controller: the small computer that keeps the drone level.' });
  if (!have.has('camera')) out.push({ kind: 'camera', count: 1, reason: 'Add a camera if you want to fly by video or film.' });
  if (ctx.payload && !have.has('payload')) out.push({ kind: 'payload', count: 1, reason: 'Add the payload you want to carry so the weight and balance include it.' });
  return out;
}
