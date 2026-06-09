import { assertRequiredScriptEnv, loadLocalEnv } from './load-env';
import { checkReadiness } from '../lib/ops';

const requiredScriptEnv = ['DATABASE_URL', 'REDIS_URL'] as const;

loadLocalEnv();
assertRequiredScriptEnv('npm run healthcheck', requiredScriptEnv);

checkReadiness()
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
