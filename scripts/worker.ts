import { loadLocalEnv } from './load-env';
import { startJobWorker } from '../lib/worker';

loadLocalEnv();

const worker = startJobWorker();
console.log('ab3ad worker running');

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
