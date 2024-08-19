import { merge } from '@fathym/common';
import { EaCCloudAzureDetails, EverythingAsCodeClouds } from '@fathym/eac/clouds';
import { loadAzureCloudCredentials } from '@fathym/eac/utils/azure';
import { EaCServiceDefinitions } from '@fathym/eac-api';
import { EaCRuntimeContext, EaCRuntimeHandlers } from '@fathym/eac-runtime';
import { ResourceManagementClient } from 'npm:@azure/arm-resources';
import { EaCAPIUserState } from '../../../../../../src/state/EaCAPIUserState.ts';

export default {
  async POST(req, ctx: EaCRuntimeContext<EaCAPIUserState>) {
    const entLookup = ctx.State.UserEaC!.EnterpriseLookup;

    const cloudLookup = ctx.Params.cloudLookup as string;

    const svcDefs: EaCServiceDefinitions = await req.json();

    const eacKv = await ctx.Runtime.IoC.Resolve<Deno.Kv>(Deno.Kv, 'eac');

    const eacResult = await eacKv.get<EverythingAsCodeClouds>([
      'EaC',
      'Current',
      entLookup,
    ]);

    const eac = eacResult.value!;

    const creds = await loadAzureCloudCredentials(eac, cloudLookup);

    let svcDefApiVersions: Record<string, string> = {};

    if (creds) {
      const details = eac.Clouds![cloudLookup!].Details as EaCCloudAzureDetails;

      const resClient = new ResourceManagementClient(
        creds,
        details.SubscriptionID
      );

      const svcDefApiVersionCalls = Object.keys(svcDefs).map(async (sd) => {
        const svcDef = svcDefs[sd];

        const provider = await resClient.providers.get(sd);

        const providerTypeApiVersions = provider.resourceTypes
          ?.filter((rt) => {
            return svcDef.Types.includes(rt.resourceType!);
          })
          .map((rt) => {
            return {
              type: rt.resourceType!,
              apiVersion: rt.defaultApiVersion!,
            };
          })!;

        const res = providerTypeApiVersions.reduce((p, c) => {
          p[c.type] = c.apiVersion;

          return p;
        }, {} as Record<string, string>);

        return res;
      });

      const svcDefApiVersionResults = await Promise.all<Record<string, string>>(
        svcDefApiVersionCalls
      );

      svcDefApiVersions = merge(
        svcDefApiVersions,
        svcDefApiVersionResults.reduce((prev, cur) => {
          const next = cur;

          return merge(prev, next);
        }, {} as Record<string, string>)
      );
    }

    return Response.json(svcDefApiVersions);
  },
} as EaCRuntimeHandlers;
