/**
 * Reactive state for DopaFlow PetSense app.
 * Svelte 5 runes: $state, $derived, $effect. No legacy stores.
 *
 * All shared state lives in a single exported object so it can be read
 * reactively from any component while still being reassigned safely from
 * within this module. Exporting individual $state primitives directly is
 * forbidden by Svelte 5 when they are reassigned.
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

// ── Shared reactive state ───────────────────────────────

export const store = $state({
  pets: [] as PetLocation[],
  alerts: [] as Alert[],
  selectedPetId: null as string | null,
  floorPlan: [] as Room[],
  isConnected: false,
  healthTrends: [] as HealthTrend[],
  petTrails: new Map<string, { x: number; y: number }[]>(),
});

// Backward-compatible named exports for tests and any existing consumers
// that read the shared state directly. Mutating these proxies updates the
// underlying `store` reactively. Reassigning them is not allowed (they are
// `const`), which matches Svelte 5's rules for exported module state.
export const pets = store.pets;
export const alerts = store.alerts;
export const selectedPetId = store.selectedPetId;
export const floorPlan = store.floorPlan;
export const isConnected = store.isConnected;
export const healthTrends = store.healthTrends;
export const petTrails = store.petTrails;

// ── Functions ─────────────────────────────────────────

export function selectPet(id: string | null): void {
  store.selectedPetId = id;
}

export function addAlert(alert: Alert): void {
  store.alerts.unshift(alert);
  if (store.alerts.length > 100) store.alerts.pop();
}

export function updatePetLocation(location: PetLocation): void {
  const idx = store.pets.findIndex((p) => p.id === location.id);
  if (idx >= 0) {
    store.pets[idx] = { ...store.pets[idx], ...location };
  } else {
    store.pets.push(location);
  }

  // Update trail
  if (!store.petTrails.has(location.id)) {
    store.petTrails.set(location.id, []);
  }
  const trail = store.petTrails.get(location.id)!;
  trail.push({ x: location.position.x, y: location.position.y });
  if (trail.length > 20) trail.shift();
}

export function loadFloorPlan(rooms: Room[]): void {
  store.floorPlan = rooms;
}

export function dismissAlert(id: string): void {
  const idx = store.alerts.findIndex((a) => a.id === id);
  if (idx >= 0) store.alerts.splice(idx, 1);
}

export function getPetTrail(id: string): { x: number; y: number }[] {
  return store.petTrails.get(id) ?? [];
}

export function getConnectionStatus(): boolean {
  return store.isConnected;
}

export function setConnectionStatus(v: boolean): void {
  store.isConnected = v;
}

// ── Wire up API listeners ────────────────────────────

onPetLocation((pet) => updatePetLocation(pet));
onAlert((a) => addAlert(a));
onConnect((connected) => {
  store.isConnected = connected;
});
