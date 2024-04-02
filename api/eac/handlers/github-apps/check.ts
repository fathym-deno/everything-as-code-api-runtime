import { respond } from '@fathym/common';
import { EaCRuntimeContext, EaCRuntimeHandlers } from '@fathym/eac/runtime';
import { EaCAPIUserState } from '../../../../src/state/EaCAPIUserState.ts';
import { EaCHandlerCheckRequest } from '../../../../src/reqres/EaCHandlerCheckRequest.ts';
import { EaCHandlerCheckResponse } from '../../../../src/reqres/EaCHandlerCheckResponse.ts';

export default {
  async POST(req, ctx: EaCRuntimeContext<EaCAPIUserState>) {
    const checkRequest: EaCHandlerCheckRequest = await req.json();

    console.log(
      `Processing EaC commit ${checkRequest.CommitID} GitHub App checks`,
    );

    return respond({
      CorelationID: checkRequest.CorelationID,
      Complete: true,
      HasError: false,
      Messages: {},
    } as EaCHandlerCheckResponse);
  },
} as EaCRuntimeHandlers;
