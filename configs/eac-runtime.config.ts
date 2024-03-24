import { DefaultEaCConfig, defineEaCConfig, EaCRuntime } from '@fathym/eac/runtime';
import EaCAPIPlugin from '../src/plugins/EaCAPIPlugin.ts';
import { listenForCommits } from '../api/handlers/index.ts';

export const config = defineEaCConfig({
  Plugins: [new EaCAPIPlugin(), ...(DefaultEaCConfig.Plugins || [])],
  Server: {
    port: 6130,
  },
});

export async function configure(rt: EaCRuntime): Promise<void> {
  await listenForCommits(rt);
}
