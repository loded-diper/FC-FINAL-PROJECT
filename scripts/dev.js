import { spawn } from 'node:child_process';
const processes = ['dev:server', 'dev:client'].map(script => spawn('npm', ['run', script], { stdio: 'inherit' }));
let stopping = false;
function stop(code = 0) { if (stopping) return; stopping = true; for (const child of processes) child.kill('SIGTERM'); process.exitCode = code; }
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
for (const child of processes) child.on('exit', code => stop(code || 0));
