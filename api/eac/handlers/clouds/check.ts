import { respond } from '@fathym/common';
import { EverythingAsCodeClouds } from '@fathym/eac';
import { EaCRuntimeContext, EaCRuntimeHandlers } from '@fathym/eac/runtime';
import { EaCAPIUserState } from '../../../../src/state/EaCAPIUserState.ts';
import { EaCHandlerCloudCheckRequest } from '../../../../src/reqres/EaCHandlerCloudCheckRequest.ts';
import { loadDeploymentDetails } from '../../../../src/eac/clouds.helpers.ts';
import { EaCHandlerCheckResponse } from '../../../../src/reqres/EaCHandlerCheckResponse.ts';

export default {
  async POST(req, ctx: EaCRuntimeContext<EaCAPIUserState>) {
    // const username = ctx.state.Username;

    const checkRequest: EaCHandlerCloudCheckRequest = await req.json();

    console.log(
      `Processing EaC commit ${checkRequest.CommitID} Cloud checks`,
    );

    try {
      const eac = checkRequest!.EaC as EverythingAsCodeClouds;

      const currentClouds = eac.Clouds || {};

      const cloud = currentClouds[checkRequest.CloudLookup] || {};

      const deployDetails = await loadDeploymentDetails(
        checkRequest.CommitID,
        cloud,
        checkRequest.Name,
        undefined,
        checkRequest.ResourceGroupLookup,
      );

      const completeStati = ["Canceled", "Failed", "Succeeded"];

      const errorStati = ["Canceled", "Failed"];

      return respond({
        Complete: completeStati.some(
          (status) =>
            status === deployDetails.Deployment.properties?.provisioningState,
        ),
        HasError: errorStati.some(
          (status) =>
            status === deployDetails.Deployment.properties?.provisioningState,
        ),
        Messages: deployDetails.Messages,
      } as EaCHandlerCheckResponse);
    } catch (err) {
      console.error(err);

      return respond({
        CorelationID: checkRequest.CorelationID,
        Complete: true,
        HasError: true,
        Messages: {
          [`Deployment: ${checkRequest.Name}`]: JSON.stringify(err),
        },
      } as EaCHandlerCheckResponse);
    }
  },
} as EaCRuntimeHandlers;
