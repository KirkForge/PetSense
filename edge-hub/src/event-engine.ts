export interface Zone {
  name: string;
  bounds: { x1: number; y1: number; x2: number; y2: number };
  type: 'alert' | 'info';
}

export interface AlertItem {
  petId: string;
  zone: string;
  zoneType: 'alert' | 'info';
  message: string;
  timestamp: number;
}

export class EventEngine {
  private zones: Zone[] = [];
  private alerts: AlertItem[] = [];
  private cooldown: Map<string, number> = new Map();
  private throttleMs = 5 * 60 * 1000;

  setZones(zones: Zone[]): void {
    this.zones = zones;
  }

  addZone(zone: Zone): void {
    this.zones.push(zone);
  }

  checkZones(petId: string, position: { x: number; y: number }): AlertItem[] {
    const triggered: AlertItem[] = [];
    for (const zone of this.zones) {
      const { x1, y1, x2, y2 } = zone.bounds;
      if (position.x < x1 || position.x > x2 || position.y < y1 || position.y > y2) continue;
      const key = `${petId}:${zone.name}`;
      const lastFired = this.cooldown.get(key) ?? 0;
      const now = Date.now();
      if (now - lastFired < this.throttleMs) continue;
      this.cooldown.set(key, now);
      const alert: AlertItem = {
        petId,
        zone: zone.name,
        zoneType: zone.type,
        message: `Pet ${petId} entered ${zone.name}`,
        timestamp: now,
      };
      this.alerts.push(alert);
      triggered.push(alert);
    }
    return triggered;
  }

  getAlerts(): AlertItem[] {
    return [...this.alerts];
  }

  drainAlerts(): AlertItem[] {
    const result = [...this.alerts];
    this.alerts = [];
    return result;
  }
}
