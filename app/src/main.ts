import App from './app.svelte';
import './app.css';
import { connect, getConnectionStatus } from '$lib/api';

const wsUrl = localStorage.getItem('petsense-hub-url') ?? `ws://${window.location.hostname}:8081/ws`;

const target = document.getElementById('app');
if (!target) throw new Error('Missing #app mount point');

const app = new App({
  target,
});

connect(wsUrl);
