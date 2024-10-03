import { EaCGitHubAppAsCode } from '@fathym/eac/github';
import { eacSetSecrets, loadSecretClient } from '@fathym/eac/utils/azure';
import { EaCRuntimeContext, EaCRuntimeHandlers } from '@fathym/eac-runtime';
import { EaCAPIUserState } from '../../../../src/state/EaCAPIUserState.ts';
import { EaCHandlerRequest } from '../../../../src/reqres/EaCHandlerRequest.ts';
import { EaCHandlerResponse } from '../../../../src/reqres/EaCHandlerResponse.ts';
import { EaCAPILoggingProvider } from '../../../../src/logging/EaCAPILoggingProvider.ts';

export default {
  async POST(req, ctx: EaCRuntimeContext<EaCAPIUserState>) {
    const logger = await ctx.Runtime.IoC.Resolve(EaCAPILoggingProvider);

    const handlerRequest: EaCHandlerRequest = await req.json();

    logger.Package.debug(
      `Processing EaC commit ${handlerRequest.CommitID} GitHub App processes for app ${handlerRequest.Lookup}`
    );

    const gitHubAppLookup = handlerRequest.Lookup;

    const gitHubApp = handlerRequest.Model as EaCGitHubAppAsCode;

    return Response.json({
      Checks: [],
      Lookup: gitHubAppLookup,
      Messages: {
        Message: `The GitHubApp '${gitHubAppLookup}' has been handled.`,
      },
      Model: gitHubApp,
    } as EaCHandlerResponse);
  },
} as EaCRuntimeHandlers;
