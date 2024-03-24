import { start } from '@fathym/eac/runtime';
import { config, configure } from './configs/eac-runtime.config.ts';

Deno.env.set('EAC_RUNTIME_DEV', 'true');

await start(await config, configure);
