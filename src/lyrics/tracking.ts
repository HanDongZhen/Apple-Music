/** Damped spring with preserved velocity. Delta time is capped after backgrounding. */
export function springStep(
  position: number,
  velocity: number,
  target: number,
  delta: number,
  stiffness = 95,
  damping = 21,
) {
  const dt = Math.min(Math.max(delta, 0), 1 / 30);
  const nextVelocity = velocity + ((target - position) * stiffness - damping * velocity) * dt;
  return { position: position + nextVelocity * dt, velocity: nextVelocity };
}
export function lyricTarget(top: number, height: number, viewport: number) {
  return Math.max(0, top + Math.min(height / 2, viewport * 0.16) - viewport * 0.38);
}
