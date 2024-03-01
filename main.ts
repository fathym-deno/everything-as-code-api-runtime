import { start } from '@fathym/eac/runtime';
import config from './configs/eac-runtime.config.ts';

await start(await config);
