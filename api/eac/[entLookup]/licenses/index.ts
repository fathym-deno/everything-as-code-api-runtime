import { UserEaCLicense } from '@fathym/eac/api';
import { EaCRuntimeHandlers } from '@fathym/eac/runtime';
import { EaCAPIUserState } from '../../../../src/state/EaCAPIUserState.ts';

export default {
  async GET(req, ctx) {
    const entLookup = ctx.State.UserEaC!.EnterpriseLookup;

    const url = new URL(req.url);

    const username = url.searchParams.get('username')!;

    const eacKv = await ctx.Runtime.IoC.Resolve<Deno.Kv>(Deno.Kv, 'eac');

    const licenses = await eacKv.get<Record<string, UserEaCLicense>>([
      'EaC',
      'Current',
      entLookup,
      'Licenses',
      username,
    ]);

    return Response.json(licenses.value || {});
  },
} as EaCRuntimeHandlers<EaCAPIUserState>;
