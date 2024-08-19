import { EaCStatus, EaCStatusProcessingTypes } from '@fathym/eac-api';
import { EaCRuntimeContext, EaCRuntimeHandlers } from '@fathym/eac-runtime';
import { EaCAPIUserState } from '../../../../src/state/EaCAPIUserState.ts';

export default {
  async GET(req, ctx: EaCRuntimeContext<EaCAPIUserState>) {
    const entLookup = ctx.State.UserEaC!.EnterpriseLookup;

    const eacKv = await ctx.Runtime.IoC.Resolve<Deno.Kv>(Deno.Kv, 'eac');

    const status = await eacKv.get<EaCStatus>([
      'EaC',
      'Status',
      entLookup,
      'EaC',
    ]);

    const idleStatus: EaCStatus = {
      ID: '',
      Messages: {},
      EnterpriseLookup: entLookup,
      Processing: EaCStatusProcessingTypes.IDLE,
      StartTime: new Date(Date.now()),
      Username: 'system',
    };

    return Response.json(status?.value! || idleStatus);
  },
} as EaCRuntimeHandlers;
