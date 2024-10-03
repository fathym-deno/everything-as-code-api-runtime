import { EverythingAsCode } from '@fathym/eac';
import {
  EaCCloudAsCode,
  EaCCloudAzureDetails,
  EverythingAsCodeClouds,
  isEaCCloudAzureDetails,
} from '@fathym/eac/clouds';
import { eacSetSecrets, loadMainSecretClient } from '@fathym/eac/utils/azure';
import { EaCRuntimeContext, EaCRuntimeHandlers } from '@fathym/eac-runtime';
import { EaCAPIUserState } from '../../../../src/state/EaCAPIUserState.ts';
import { EaCHandlerRequest } from '../../../../src/reqres/EaCHandlerRequest.ts';
import { EaCHandlerCheckRequest } from '../../../../src/reqres/EaCHandlerCheckRequest.ts';
import { EaCHandlerResponse } from '../../../../src/reqres/EaCHandlerResponse.ts';
import { EaCHandlerErrorResponse } from '../../../../src/reqres/EaCHandlerErrorResponse.ts';
import {
  beginEaCDeployments,
  buildCloudDeployments,
  ensureRoleAssignments,
  finalizeCloudDetails,
} from '../../../../src/eac/clouds.helpers.ts';
import { EaCAPILoggingProvider } from '../../../../src/logging/EaCAPILoggingProvider.ts';

export default {
  async POST(req, ctx: EaCRuntimeContext<EaCAPIUserState>) {
    const logger = await ctx.Runtime.IoC.Resolve(EaCAPILoggingProvider);

    try {
      // const username = ctx.state.Username;

      const handlerRequest: EaCHandlerRequest = await req.json();

      logger.Package.debug(
        `Processing EaC commit ${handlerRequest.CommitID} Cloud processes for cloud ${handlerRequest.Lookup}`
      );

      const eac = handlerRequest.EaC as EverythingAsCode &
        EverythingAsCodeClouds;

      const currentClouds = eac.Clouds || {};

      const cloudLookup = handlerRequest.Lookup;

      const current = currentClouds[cloudLookup] || {};

      const cloud = handlerRequest.Model as EaCCloudAsCode;

      await finalizeCloudDetails(
        logger.Package,
        eac.EnterpriseLookup!,
        cloudLookup,
        handlerRequest.CommitID,
        cloud
      );

      const deployments = await buildCloudDeployments(
        logger.Package,
        handlerRequest.CommitID,
        eac,
        cloudLookup,
        cloud
      );

      const checks: EaCHandlerCheckRequest[] = await beginEaCDeployments(
        logger.Package,
        handlerRequest.CommitID,
        cloud.Details ? cloud : current,
        deployments
      );

      const secretClient = await loadMainSecretClient();

      const secretRoot = `cloud-${cloudLookup}`;

      const cloudDetails = cloud.Details;

      if (
        isEaCCloudAzureDetails(cloudDetails) &&
        !cloudDetails.AuthKey.startsWith('$secret:')
      ) {
        const secreted = await eacSetSecrets(secretClient, secretRoot, {
          AuthKey: cloudDetails.AuthKey,
        });

        cloud.Details = {
          ...cloud.Details,
          ...secreted,
        } as EaCCloudAzureDetails;
      }

      return Response.json({
        Checks: checks,
        Lookup: cloudLookup,
        Messages: {
          Message: `The cloud '${cloudLookup}' has been handled.`,
        },
        Model: cloud,
      } as EaCHandlerResponse);
    } catch (err) {
      logger.Package.error(
        'There was an error starting the cloud deployments',
        err
      );

      return Response.json({
        HasError: true,
        Messages: {
          Error: JSON.stringify(err),
        },
      } as EaCHandlerErrorResponse);
    }
  },
} as EaCRuntimeHandlers;
