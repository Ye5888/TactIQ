export type FormationSlot = { x: number; y: number };
export type Formation = FormationSlot[];

export const ONE_TWO_ONE: Formation = [
  { x: 0.08, y: 0.5 },
  { x: 0.25, y: 0.5 },
  { x: 0.55, y: 0.2 },
  { x: 0.55, y: 0.8 },
  { x: 0.85, y: 0.5 },
];

export const TWO_TWO: Formation = [
  { x: 0.15, y: 0.3 },
  { x: 0.15, y: 0.7 },
  { x: 0.5, y: 0.5 },
  { x: 0.75, y: 0.3 },
  { x: 0.75, y: 0.7 },
];

export const FORMATIONS: { name: string; formation: Formation }[] = [
  { name: '1-2-1', formation: ONE_TWO_ONE },
  { name: '2-2', formation: TWO_TWO },
];

export function formationToWorldPositions(formation: Formation, side: 'left' | 'right'): FormationSlot[] {
  return formation.map((slot) => {
    const worldX = side === 'left' ? slot.x * 600 : 1200 - slot.x * 600;
    const worldY = slot.y * 600;
    return { x: worldX, y: worldY };
  });
}