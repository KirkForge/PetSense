import App from './app.svelte';
import './app.css';
import { connect, getConnectionStatus } from '$lib/api';

// Hub WS endpoint: APIServer upgrades /api/realtime on port 3000
// (edge-hub/src/api-server.ts:27, index.ts:13). Firmware speaks MQTT :1883;
// the hub bridges WS→MQTT. App+hub are deferred under the firmware-first pivot
// (see PIVOT.md) — this is the intended endpoint, not a live connection today.
const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = localStorage.getItem('petsense-hub-url')
  ?? `${proto}//${window.location.hostname}:3000/api/realtime`;

const target = document.getElementById('app');
if (!target) throw new Error('Missing #app mount point');

const app = new App({
  target,
});

connect(wsUrl);
