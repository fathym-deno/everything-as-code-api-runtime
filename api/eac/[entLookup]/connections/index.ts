import { EaCMetadataBase, EverythingAsCode } from '@fathym/eac';
import { EaCRuntimeContext, EaCRuntimeHandlers } from '@fathym/eac/runtime';
import { EaCAPIUserState } from '../../../../src/state/EaCAPIUserState.ts';
import { loadConnections } from '../../../../src/utils/eac/loadConnections.ts';

export default {
  async POST(req, ctx: EaCRuntimeContext<EaCAPIUserState>) {
    const entLookup = ctx.State.UserEaC!.EnterpriseLookup;

    const eacDef: EverythingAsCode = await req.json();

    const eacKv = await ctx.Runtime.IoC.Resolve<Deno.Kv>(Deno.Kv, 'eac');

    const eac = await eacKv.get<EverythingAsCode>([
      'EaC',
      'Current',
      entLookup,
    ]);

    const eacConnections = {} as EverythingAsCode;

    const eacDefKeys = Object.keys(eacDef || {});

    const connectionCalls = eacDefKeys.map(async (key) => {
      const def = (eacDef[key]! || {}) as Record<string, EaCMetadataBase>;

      let lookups = Object.keys(def);

      const current = (eac.value![key]! || {}) as Record<
        string,
        EaCMetadataBase
      >;

      if (lookups.length === 0) {
        lookups = Object.keys(current);
      }

      const handler = eac.value!.Handlers![key];

      if (handler) {
        eacConnections[key] = await loadConnections(
          eacKv,
          eac.value!,
          handler,
          ctx.State.JWT!,
          def,
          current,
          lookups
        );
      }
    });

    await Promise.all(connectionCalls);

    return Response.json(eacConnections);
  },
} as EaCRuntimeHandlers;
