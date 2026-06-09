import { loadLocalEnv } from './load-env';
import { checkReadiness } from '../lib/ops';

loadLocalEnv();

checkReadiness()
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
