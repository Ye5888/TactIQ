export type FormationSlot = { x: number; y: number };
export type Formation = FormationSlot[];

export const ONE_TWO_ONE: Formation = [
  { x: 0.08, y: 0.5 },
  { x: 0.25, y: 0.5 },
  { x: 0.55, y: 0.2 },
  { x: 0.55, y: 0.8 },
  { x: 0.85, y: 0.5 },
];

export function formationToWorldPositions(formation: Formation, side: 'left' | 'right'): FormationSlot[] {
  return formation.map((slot) => {
    const worldX = side === 'left' ? slot.x * 600 : 1200 - slot.x * 600;
    const worldY = slot.y * 600;
    return { x: worldX, y: worldY };
  });
}