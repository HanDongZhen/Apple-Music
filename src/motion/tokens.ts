export const spring = {
  soft: { type: 'spring', stiffness: 180, damping: 25, mass: 1 },
  normal: { type: 'spring', stiffness: 300, damping: 30, mass: 0.8 },
  snappy: { type: 'spring', stiffness: 420, damping: 34, mass: 0.65 },
  sheet: { type: 'spring', stiffness: 260, damping: 32, mass: 1 },
  player: { type: 'spring', stiffness: 200, damping: 28, mass: 1 },
} as const;
