/**
 * Touch screens (phones, tablets): a coarse primary pointer means fingers. Decided once at start,
 * so texts, defaults and the touch-only buttons stay consistent for the whole session.
 * Safe in Node (scripts, tests): there it is always false.
 */
let cached: boolean | null = null;

export function isTouchDevice(): boolean {
  if (cached !== null) return cached;
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return (cached = false);
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  // `?touch=1` in the address forces touch mode on a desktop (testing the phone layout with a mouse).
  const forced = /[?&]touch=1/.test(window.location?.search ?? '');
  return (cached = coarse || forced);
}
