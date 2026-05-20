/**
 * WebSocket client to edge hub.
 * Auto-reconnect with exponential backoff, heartbeat ping every 15s.
 */

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

type PetCallback = (pet: PetLocation) => void;
type AlertCallback = (alert: Alert) => void;

let ws: WebSocket | null = null;
let url = '';
let reconnectDelay = 1000;
const MAX_DELAY = 30000;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

const petLocationListeners: PetCallback[] = [];
const alertListeners: AlertCallback[] = [];
const connectionListeners: Array<(connected: boolean) => void> = [];

export function connect(wsUrl: string): void {
  url = wsUrl;
  doConnect();
}

function doConnect(): void {
  if (!url) return;

  try {
    ws = new WebSocket(url);
  } catch {
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    reconnectDelay = 1000;
    stopHeartbeat();
    heartbeatTimer = setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 15000);
    notifyConnection(true);
  };

  ws.onmessage = (event: MessageEvent) => {
    try {
      const msg = JSON.parse(event.data as string);
      if (msg.type === 'pong') return;

      if (msg.type === 'pet_location' && msg.data) {
        const pet = msg.data as PetLocation;
        petLocationListeners.forEach((fn) => fn(pet));
      }

      if (msg.type === 'alert' && msg.data) {
        const alert = msg.data as Alert;
        alertListeners.forEach((fn) => fn(alert));
      }
    } catch {
      /* ignore malformed messages */
    }
  };

  ws.onclose = () => {
    notifyConnection(false);
    stopHeartbeat();
    ws = null;
    scheduleReconnect();
  };

  ws.onerror = () => {
    ws?.close();
  };
}

function scheduleReconnect(): void {
  if (reconnectTimer) return;
  notifyConnection(false);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    doConnect();
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_DELAY);
  }, reconnectDelay);
}

function stopHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function notifyConnection(connected: boolean): void {
  connectionListeners.forEach((fn) => fn(connected));
}

export function onConnect(callback: (connected: boolean) => void): void {
  connectionListeners.push(callback);
}

export function getConnectionStatus(): boolean {
  return ws?.readyState === WebSocket.OPEN;
}

export function onPetLocation(callback: PetCallback): () => void {
  petLocationListeners.push(callback);
  return () => {
    const idx = petLocationListeners.indexOf(callback);
    if (idx >= 0) petLocationListeners.splice(idx, 1);
  };
}

export function onAlert(callback: AlertCallback): () => void {
  alertListeners.push(callback);
  return () => {
    const idx = alertListeners.indexOf(callback);
    if (idx >= 0) alertListeners.splice(idx, 1);
  };
}

export function disconnect(): void {
  stopHeartbeat();
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  reconnectDelay = MAX_DELAY + 1; /* prevent reconnects */
  ws?.close();
  ws = null;
}
