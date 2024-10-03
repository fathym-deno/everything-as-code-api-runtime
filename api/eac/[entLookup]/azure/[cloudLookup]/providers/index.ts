import {
  EaCCloudAzureDetails,
  EverythingAsCodeClouds,
} from '@fathym/eac/clouds';
import { loadAzureCloudCredentials } from '@fathym/eac/utils/azure';
import { EaCServiceDefinitions } from '@fathym/eac-api';
import { EaCRuntimeContext, EaCRuntimeHandlers } from '@fathym/eac-runtime';
import { Provider, ResourceManagementClient } from 'npm:@azure/arm-resources';
import { EaCAPIUserState } from '../../../../../../src/state/EaCAPIUserState.ts';
import { EaCAPILoggingProvider } from '../../../../../../src/logging/EaCAPILoggingProvider.ts';

export default {
  async POST(req, ctx: EaCRuntimeContext<EaCAPIUserState>) {
    const logger = await ctx.Runtime.IoC.Resolve(EaCAPILoggingProvider);

    const entLookup = ctx.State.UserEaC!.EnterpriseLookup;

    const cloudLookup = ctx.Params.cloudLookup as string;

    logger.Package.debug(
      `Ensuring providers are registered to cloud ${cloudLookup} for enterprise ${entLookup}`
    );

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

      const svcDevLookups = [...new Set(Object.keys(svcDefs))];

      const svcDefProviderCalls = svcDevLookups.map(async (sd) => {
        const provider = await resClient.providers.register(sd);

        logger.Package.debug(
          `Registered provider ${sd} to cloud ${cloudLookup} for enterprise ${entLookup}`
        );

        return provider;
      });

      await Promise.all<Provider>(svcDefProviderCalls);
    }

    logger.Package.debug(
      `Providers are registered to cloud ${cloudLookup} for enterprise ${entLookup}`
    );

    return Response.json({
      Locations: locations,
    });
  },
} as EaCRuntimeHandlers;
