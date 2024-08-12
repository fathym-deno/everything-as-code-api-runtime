import { EaCStatus } from '@fathym/eac-api';
import { EaCRuntimeContext, EaCRuntimeHandlers } from '@fathym/eac/runtime';
import { EaCAPIUserState } from '../../../../../src/state/EaCAPIUserState.ts';

export default {
  async GET(req, ctx: EaCRuntimeContext<EaCAPIUserState>) {
    const entLookup = ctx.State.UserEaC!.EnterpriseLookup;

    const commitId = ctx.Params.commitId as string;

    const eacKv = await ctx.Runtime.IoC.Resolve<Deno.Kv>(Deno.Kv, 'eac');

    const status = await eacKv.get<EaCStatus>([
      'EaC',
      'Status',
      entLookup,
      'ID',
      commitId,
    ]);

    return Response.json(status?.value! || {});
  },
} as EaCRuntimeHandlers;
