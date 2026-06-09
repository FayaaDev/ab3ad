import { assertRequiredScriptEnv, getScriptEnvPresence, loadLocalEnv } from './load-env';
import { startJobWorker } from '../lib/worker';

const requiredScriptEnv = ['DATABASE_URL', 'REDIS_URL'] as const;

loadLocalEnv();
assertRequiredScriptEnv('npm run worker', requiredScriptEnv);

const worker = startJobWorker();
console.log('ab3ad worker running', {
  env: getScriptEnvPresence(requiredScriptEnv),
  hi3dMode: process.env.HI3D_MODE ?? 'mock',
});

const shutdown = async (signal: string) => {
  console.log(`Shutting down worker (${signal})`);
  await worker.close();
  process.exit(0);
};

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
