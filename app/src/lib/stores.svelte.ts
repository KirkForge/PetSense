/**
 * Reactive state for DopaFlow PetSense app.
 * Svelte 5 runes: $state, $derived, $effect. No legacy stores.
 */

import { onPetLocation, onAlert, onConnect } from '$lib/api';

// ── Types ──────────────────────────────────────────────

export interface PetLocation {
  id: string;
  species: 'dog' | 'cat';
  name?: string;
  position: { x: number; y: number };
  room: string;
  activity: string;
  confidence: number;
}

export interface Alert {
  id: string;
  type: string;
  message: string;
  timestamp: number;
  petId?: string;
}

export interface Room {
  name: string;
  bounds: { x1: number; y1: number; x2: number; y2: number };
  color?: string;
}

export interface HealthTrend {
  petId: string;
  dailyActiveMinutes: number[];
  baselineAvg: number;
  currentWeekAvg: number;
  previousWeekAvg: number;
  anomaly: boolean;
}

// ── State ─────────────────────────────────────────────

export const pets: PetLocation[] = $state([]);
export const alerts: Alert[] = $state([]);
export let selectedPetId: string | null = $state(null);
export let floorPlan: Room[] = $state([]);
let isConnected = $state(false);
export function getConnectionStatus(): boolean { return isConnected; }
export function setConnectionStatus(v: boolean): void { isConnected = v; }
export const healthTrends: HealthTrend[] = $state([]);

// Track pet trails (last 20 positions per pet)
export const petTrails: Map<string, { x: number; y: number }[]> = new Map();

// ── Functions ─────────────────────────────────────────

export function selectPet(id: string | null): void {
  selectedPetId = id;
}

export function addAlert(alert: Alert): void {
  alerts.unshift(alert);
  if (alerts.length > 100) alerts.pop();
}

export function updatePetLocation(location: PetLocation): void {
  const idx = pets.findIndex((p) => p.id === location.id);
  if (idx >= 0) {
    pets = [...pets.slice(0, idx), { ...pets[idx], ...location }, ...pets.slice(idx + 1)];
  } else {
    pets = [...pets, location];
  }

  // Update trail
  if (!petTrails.has(location.id)) {
    petTrails.set(location.id, []);
  }
  const trail = petTrails.get(location.id)!;
  trail.push({ x: location.position.x, y: location.position.y });
  if (trail.length > 20) trail.shift();
}

export function loadFloorPlan(rooms: Room[]): void {
  floorPlan = rooms;
}

export function dismissAlert(id: string): void {
  const idx = alerts.findIndex((a) => a.id === id);
  if (idx >= 0) alerts.splice(idx, 1);
}

export function getPetTrail(id: string): { x: number; y: number }[] {
  return petTrails.get(id) ?? [];
}

// ── Wire up API listeners ────────────────────────────

onPetLocation((pet) => updatePetLocation(pet));
onAlert((a) => addAlert(a));
onConnect((connected) => { isConnected = connected; });
