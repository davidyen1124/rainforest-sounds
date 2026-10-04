import './style.css';
import { Bus } from './bus';
import { mountUI } from './ui';

const bus = new Bus();
mountUI(document.getElementById('ui')!, bus);
// the physics world (three + rapier wasm) is the heavy part; the intake form shows while it loads
import('./world').then(({ createWorld }) => createWorld(document.getElementById('scene') as HTMLCanvasElement, bus));
