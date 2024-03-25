import { respond } from '@fathym/common';
import { EverythingAsCodeClouds } from '@fathym/eac';
import { loadKustoClient } from '@fathym/eac/azure';
import { ExplorerRequest } from '@fathym/eac/api';
import { EaCRuntimeContext, EaCRuntimeHandlers } from '@fathym/eac/runtime';
import { EaCAPIUserState } from '../../../../../../../../../src/state/EaCAPIUserState.ts';

export default {
  async POST(req, ctx: EaCRuntimeContext<EaCAPIUserState>) {
    const entLookup = ctx.State.UserEaC!.EnterpriseLookup;

    const cloudLookup = ctx.Params.cloudLookup as string;

    const resGroupLookup = ctx.Params.resGroupLookup as string;

    const resLookups = decodeURIComponent(
      ctx.Params.resLookups as string
    ).split('|');

    const db = ctx.Params.db as string;

    const url = new URL(req.url);

    const svcSuffix = url.searchParams.get('svcSuffix') as string | undefined;

    const explorerReq: ExplorerRequest = await req.json();

    const kustoClient = await loadKustoClient(
      entLookup,
      cloudLookup,
      resGroupLookup,
      resLookups,
      async (entLookup) => {
        const eacKv = await ctx.Runtime.IoC.Resolve<Deno.Kv>(Deno.Kv, 'eac');

        const eac = await eacKv.get<EverythingAsCodeClouds>(['EaC', entLookup]);

        return eac.value!;
      },
      svcSuffix
    );

    kustoClient.ensureOpen();

    console.log(explorerReq);

    const dataSetResp = await kustoClient.execute(db, explorerReq.Query);

    return respond(JSON.stringify(dataSetResp));
  },
} as EaCRuntimeHandlers;
