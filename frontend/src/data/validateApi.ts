import type { Formation } from './formations';
import type { RosterPlayer } from './roster';

export type FormationOption = { _id: string; name: string; slots: Formation };

export function validateFormations(data: unknown): FormationOption[] {
  if (!Array.isArray(data) || data.length === 0) throw new Error('No formations available');
  if (!data.every(f => f !== null && typeof f === 'object' &&
    typeof f._id === 'string' && typeof f.name === 'string' && f.name.trim() &&
    Array.isArray(f.slots) && f.slots.length === 5 &&
    f.slots.every((s: unknown) => s !== null && typeof s === 'object' &&
      'x' in s && 'y' in s && typeof s.x === 'number' && typeof s.y === 'number' &&
      Number.isFinite(s.x) && Number.isFinite(s.y) &&
      s.x >= 0 && s.x <= 1 && s.y >= 0 && s.y <= 1))) {
    throw new Error('Invalid formation data');
  }
  return data as FormationOption[];
}

export function validateDraftPlayers(data: unknown): RosterPlayer[] {
  if (!Array.isArray(data) || data.length < 5) throw new Error('Not enough players for a draft');
  if (!data.every(p => p !== null && typeof p === 'object' &&
    typeof p.name === 'string' && p.name.trim() &&
    typeof p.pace === 'number' && Number.isFinite(p.pace) && p.pace >= 0 && p.pace <= 100 &&
    typeof p.shot === 'number' && Number.isFinite(p.shot) && p.shot >= 0 && p.shot <= 100)) {
    throw new Error('Invalid player data');
  }
  return data as RosterPlayer[];
}
