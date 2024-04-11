import { respond } from '@fathym/common';
import { EverythingAsCodeClouds } from '@fathym/eac';
import { loadAzureCloudCredentials } from '@fathym/eac/azure';
import { EaCRuntimeContext, EaCRuntimeHandlers } from '@fathym/eac/runtime';
import { EaCAPIUserState } from '../../../../../../src/state/EaCAPIUserState.ts';

export default {
  async GET(req, ctx: EaCRuntimeContext<EaCAPIUserState>) {
    const entLookup = ctx.State.UserEaC!.EnterpriseLookup;

    const cloudLookup = ctx.Params.cloudLookup as string;

    const url = new URL(req.url);

    const scopes: string[] = (url.searchParams.get('scope') as string).split(
      ','
    );

    const eacKv = await ctx.Runtime.IoC.Resolve<Deno.Kv>(Deno.Kv, 'eac');

    const eacResult = await eacKv.get<EverythingAsCodeClouds>([
      'EaC',
      entLookup,
    ]);

    const eac = eacResult.value!;

    const creds = await loadAzureCloudCredentials(eac, cloudLookup);

    const authToken = await creds.getToken(scopes);

    return respond({
      Token: authToken.token,
    });
  },
} as EaCRuntimeHandlers;
