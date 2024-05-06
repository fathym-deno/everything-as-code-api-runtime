import { respond } from '@fathym/common';
import {
  EaCCloudAsCode,
  EaCCloudAzureDetails,
  EverythingAsCode,
  EverythingAsCodeClouds,
  isEaCCloudAzureDetails,
} from '@fathym/eac';
import {
  eacSetSecrets,
  loadAzureCloudCredentials,
  loadMainSecretClient,
} from '@fathym/eac/azure';
import { EaCRuntimeContext, EaCRuntimeHandlers } from '@fathym/eac/runtime';
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

export default {
  async POST(req, ctx: EaCRuntimeContext<EaCAPIUserState>) {
    try {
      // const username = ctx.state.Username;

      const handlerRequest: EaCHandlerRequest = await req.json();

      console.log(
        `Processing EaC commit ${handlerRequest.CommitID} Cloud processes for cloud ${handlerRequest.Lookup}`
      );

      const eac = handlerRequest.EaC as EverythingAsCode &
        EverythingAsCodeClouds;

      const currentClouds = eac.Clouds || {};

      const cloudLookup = handlerRequest.Lookup;

      const current = currentClouds[cloudLookup] || {};

      const cloud = handlerRequest.Model as EaCCloudAsCode;

      await finalizeCloudDetails(
        eac.EnterpriseLookup!,
        cloudLookup,
        handlerRequest.CommitID,
        cloud
      );

      const deployments = await buildCloudDeployments(
        handlerRequest.CommitID,
        eac,
        cloudLookup,
        cloud
      );

      const checks: EaCHandlerCheckRequest[] = await beginEaCDeployments(
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

      return respond({
        Checks: checks,
        Lookup: cloudLookup,
        Messages: {
          Message: `The cloud '${cloudLookup}' has been handled.`,
        },
        Model: cloud,
      } as EaCHandlerResponse);
    } catch (err) {
      console.error(err);

      return respond({
        HasError: true,
        Messages: {
          Error: JSON.stringify(err),
        },
      } as EaCHandlerErrorResponse);
    }
  },
} as EaCRuntimeHandlers;
