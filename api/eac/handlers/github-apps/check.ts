import { EaCRuntimeContext, EaCRuntimeHandlers } from '@fathym/eac-runtime';
import { EaCAPIUserState } from '../../../../src/state/EaCAPIUserState.ts';
import { EaCHandlerCheckRequest } from '../../../../src/reqres/EaCHandlerCheckRequest.ts';
import { EaCHandlerCheckResponse } from '../../../../src/reqres/EaCHandlerCheckResponse.ts';
import { EaCAPILoggingProvider } from '../../../../src/logging/EaCAPILoggingProvider.ts';

export default {
  async POST(req, ctx: EaCRuntimeContext<EaCAPIUserState>) {
    const logger = await ctx.Runtime.IoC.Resolve(EaCAPILoggingProvider);

    const checkRequest: EaCHandlerCheckRequest = await req.json();

    logger.Package.debug(
      `Processing EaC commit ${checkRequest.CommitID} GitHub App checks`
    );

    return Response.json({
      CorelationID: checkRequest.CorelationID,
      Complete: true,
      HasError: false,
      Messages: {},
    } as EaCHandlerCheckResponse);
  },
} as EaCRuntimeHandlers;
