import { respond } from '@fathym/common';
import { EaCCloudAsCode, deconstructCloudDetailsSecrets } from '@fathym/eac';
import { EaCRuntimeContext, EaCRuntimeHandlers } from '@fathym/eac/runtime';
import { EaCAPIUserState } from '../../../../src/state/EaCAPIUserState.ts';
import { EaCHandlerConnectionsRequest } from '../../../../src/reqres/EaCHandlerConnectionsRequest.ts';
import { EaCHandlerConnectionsResponse } from '../../../../src/reqres/EaCHandlerConnectionsResponse.ts';
import { loadCloudResourceGroupsConnections } from '../../../../src/eac/clouds.helpers.ts'

export default {
  async POST(req, ctx: EaCRuntimeContext<EaCAPIUserState>) {
    const handlerRequest: EaCHandlerConnectionsRequest = await req.json();

    const cloudDef = handlerRequest.Model as EaCCloudAsCode;

    let resGroupLookups = Object.keys(cloudDef.ResourceGroups || {});

    const cloud = handlerRequest.Current as EaCCloudAsCode;

    if (resGroupLookups.length === 0) {
      resGroupLookups = Object.keys(cloud.ResourceGroups || {});
    }

    cloud.Details = await deconstructCloudDetailsSecrets(cloud.Details);

    return respond({
      Model: {
        ResourceGroups: await loadCloudResourceGroupsConnections(
          cloud,
          cloudDef.ResourceGroups || {},
          cloud.ResourceGroups || {},
          resGroupLookups,
        ),
      } as EaCCloudAsCode,
    } as EaCHandlerConnectionsResponse);
  },
} as EaCRuntimeHandlers;
