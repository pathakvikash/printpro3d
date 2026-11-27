// Which simplified visual a bought (not printed) assembly part gets. Pure, no three: runs in node tests.
export type BoughtKind = 'motor' | 'prop' | 'board' | 'battery' | 'camera' | 'other';

export function boughtKind(label: string, id: string, shape?: 'box' | 'cylinder'): BoughtKind {
  const t = `${label} ${id}`.toLowerCase();
  if (/propeller|\bprop\d*\b|rotor blade/.test(t)) return 'prop';
  if (/camera/.test(t)) return 'camera';
  if (/battery|lipo/.test(t)) return 'battery';
  if (/\bmotor/.test(t) && !/main shaft/.test(t) && shape === 'cylinder') return 'motor'; // a box-shaped motor (N20 gear motor) draws as a plain box
  if (/\baio\b|flight|esp32|\bboard\b|\bpcb\b|led panel/.test(t) && shape !== 'cylinder') return 'board';
  return 'other';
}
