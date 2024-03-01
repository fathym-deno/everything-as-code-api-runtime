import { DefaultEaCConfig, defineEaCConfig, FathymDemoPlugin } from '@fathym/eac/runtime';

export default defineEaCConfig({
  Plugins: [new FathymDemoPlugin(), ...(DefaultEaCConfig.Plugins || [])],
});
