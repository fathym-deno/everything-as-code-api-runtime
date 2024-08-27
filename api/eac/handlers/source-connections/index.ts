import { EaCSourceConnectionAsCode } from '@fathym/eac/sources';
import { EaCRuntimeContext, EaCRuntimeHandlers } from '@fathym/eac-runtime';
import { EaCHandlerResponse } from '../../../../src/reqres/EaCHandlerResponse.ts';
import { EaCHandlerRequest } from '../../../../src/reqres/EaCHandlerRequest.ts';
import { EaCAPIUserState } from '../../../../src/state/EaCAPIUserState.ts';
import { EaCAPILoggingProvider } from '../../../../src/plugins/EaCAPILoggingProvider.ts';

export default {
  async POST(req, ctx: EaCRuntimeContext<EaCAPIUserState>) {
    const logger = await ctx.Runtime.IoC.Resolve(EaCAPILoggingProvider);

    const handlerRequest: EaCHandlerRequest = await req.json();

    logger.Package.debug(
      `Processing EaC commit ${handlerRequest.CommitID} Source Connection processes for source connection ${handlerRequest.Lookup}`
    );

    const srcConnLookup = handlerRequest.Lookup;

    const srcConn = handlerRequest.Model as EaCSourceConnectionAsCode;

    return Response.json({
      Checks: [],
      Lookup: srcConnLookup,
      Messages: {
        Message: `The source connection '${srcConnLookup}' has been handled.`,
      },
      Model: srcConn,
    } as EaCHandlerResponse);
  },
} as EaCRuntimeHandlers;
