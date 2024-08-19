import { STATUS_CODE } from '@std/http/status';
import { UserEaCRecord } from '@fathym/eac-api';
import { EaCRuntimeContext, EaCRuntimeHandler } from '@fathym/eac-runtime';
import { EaCAPIUserState } from '../../../src/state/EaCAPIUserState.ts';

export default (async (
  req,
  ctx: EaCRuntimeContext<EaCAPIUserState>
) => {
    const username = ctx.State.Username!;
  
    const entLookup = ctx.Params.entLookup!;
  
    if (entLookup !== ctx.State.EnterpriseLookup) {
      return Response.json(
        {
          Message:
            `The current JWT does not have access to the enterprise '${entLookup}'.`,
        },
        {
          status: STATUS_CODE.Unauthorized,
        },
      );
    }
  
    const eacKv = await ctx.Runtime.IoC.Resolve<Deno.Kv>(Deno.Kv, 'eac');

    let userEaC = await eacKv.get<UserEaCRecord>([
      "User",
      username,
      "EaC",
      entLookup,
    ]);
  
    if (!userEaC.value) {
      userEaC = await eacKv.get<UserEaCRecord>([
        "User",
        username,
        "Archive",
        "EaC",
        entLookup,
      ]);
    }
  
    if (!userEaC?.value) {
      return Response.json(
        {
          Message: `You do not have access to the enterprise '${entLookup}'.`,
        },
        {
          status: STATUS_CODE.Unauthorized,
        },
      );
    }
  
    ctx.State.UserEaC = userEaC.value;
  
    return ctx.Next();
}) as EaCRuntimeHandler;
