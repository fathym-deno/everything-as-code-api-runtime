import { respond } from '@fathym/common';
import {
  EaCGitHubAppAsCode,
  EaCGitHubAppDetails,
  EverythingAsCodeGitHub,
} from '@fathym/eac';
import {
  eacSetSecrets,
  loadSecretClient,
} from '@fathym/eac/azure';
import { EaCRuntimeContext, EaCRuntimeHandlers } from '@fathym/eac/runtime';
import { EaCAPIUserState } from '../../../../src/state/EaCAPIUserState.ts';
import { EaCHandlerRequest } from '../../../../src/reqres/EaCHandlerRequest.ts';
import { EaCHandlerResponse } from '../../../../src/reqres/EaCHandlerResponse.ts';

export default {
  async POST(req, ctx: EaCRuntimeContext<EaCAPIUserState>) {
    const handlerRequest: EaCHandlerRequest = await req.json();

    console.log(
      `Processing EaC commit ${handlerRequest.CommitID} GitHub App processes for app ${handlerRequest.Lookup}`
    );

    const gitHubAppLookup = handlerRequest.Lookup;

    const gitHubApp = handlerRequest.Model as EaCGitHubAppAsCode;

    return respond({
      Checks: [],
      Lookup: gitHubAppLookup,
      Messages: {
        Message: `The GitHubApp '${gitHubAppLookup}' has been handled.`,
      },
      Model: gitHubApp,
    } as EaCHandlerResponse);
  },
} as EaCRuntimeHandlers;
