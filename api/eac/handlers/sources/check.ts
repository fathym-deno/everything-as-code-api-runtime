import { EaCRuntimeContext, EaCRuntimeHandlers } from '@fathym/eac-runtime';
import { EaCAPIUserState } from '../../../../src/state/EaCAPIUserState.ts';
import { EaCHandlerCheckRequest } from '../../../../src/reqres/EaCHandlerCheckRequest.ts';
import { EaCHandlerCheckResponse } from '../../../../src/reqres/EaCHandlerCheckResponse.ts';
import { EaCAPILoggingProvider } from '../../../../src/logging/EaCAPILoggingProvider.ts';

export default {
  async POST(req, ctx: EaCRuntimeContext<EaCAPIUserState>) {
    const logger = ctx.Runtime.Logs;

    const checkRequest: EaCHandlerCheckRequest = await req.json();

    logger.Package.debug(
      `Processing EaC commit ${checkRequest.CommitID} Source checks`
    );

    return Response.json({
      CorelationID: checkRequest.CorelationID,
      Complete: true,
      HasError: false,
      Messages: {},
    } as EaCHandlerCheckResponse);
  },
} as EaCRuntimeHandlers;
