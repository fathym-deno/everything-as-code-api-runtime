import {
  EaCCloudAzureDetails,
  EverythingAsCodeClouds,
} from '@fathym/eac/clouds';
import { EaCServiceDefinitions } from '@fathym/eac-api';
import { loadAzureCloudCredentials } from '@fathym/eac/utils/azure';
import { EaCRuntimeContext, EaCRuntimeHandlers } from '@fathym/eac-runtime';
import { ResourceManagementClient } from 'npm:@azure/arm-resources';
import { Location, SubscriptionClient } from 'npm:@azure/arm-subscriptions';
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

    const locations: Location[] = [];

    if (creds) {
      const details = eac.Clouds![cloudLookup!].Details as EaCCloudAzureDetails;

      const resClient = new ResourceManagementClient(
        creds,
        details.SubscriptionID
      );

      const svcDefLocationCalls = Object.keys(svcDefs).map(async (sd) => {
        const svcDef = svcDefs[sd];

        const provider = await resClient.providers.get(sd);

        const providerTypeLocations = provider.resourceTypes
          ?.filter((rt) => {
            return svcDef.Types.includes(rt.resourceType!);
          })
          .map((rt) => rt.locations!)!;

        return Array.from(new Set(...providerTypeLocations));
      });

      const svcDefLocations = await Promise.all<string[]>(svcDefLocationCalls);

      const locationNames = Array.from(new Set(...svcDefLocations));

      const subClient = new SubscriptionClient(creds);

      const subLocationsList = subClient.subscriptions.listLocations(
        details.SubscriptionID
      );

      for await (const subLocation of subLocationsList) {
        if (
          locationNames.length === 0 ||
          locationNames.includes(subLocation.displayName!)
        ) {
          locations.push(subLocation);
        }
      }
    }

    return Response.json({
      Locations: locations,
    });
  },
} as EaCRuntimeHandlers;
