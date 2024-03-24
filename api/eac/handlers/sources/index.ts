import { delay } from '$std/async/delay.ts';
import { respond } from '@fathym/common';
import {
  EaCGitHubAppDetails,
  EaCSourceActionType,
  EaCSourceAsCode,
  EverythingAsCode,
  EverythingAsCodeGitHub,
  EverythingAsCodeSources,
  eacGetSecrets,
  loadSecretClient,
} from '@fathym/eac';
import { EaCRuntimeContext, EaCRuntimeHandlers } from '@fathym/eac/runtime';
import { EaCAPIUserState } from '../../../../src/state/EaCAPIUserState.ts';
import { EaCHandlerRequest } from '../../../../src/reqres/EaCHandlerRequest.ts';
import {
  ensureSource,
  ensureSourceArtifacts,
  ensureSourceSecrets,
} from '../../../../src/eac/sources.helpers.ts';
import { EaCHandlerResponse } from '../../../../src/reqres/EaCHandlerResponse.ts';
import { EaCHandlerErrorResponse } from '../../../../src/reqres/EaCHandlerErrorResponse.ts';

export default {
  async POST(req, ctx: EaCRuntimeContext<EaCAPIUserState>) {
    try {
      // const username = ctx.state.Username;

      const handlerRequest: EaCHandlerRequest = await req.json();

      console.log(
        `Processing EaC commit ${handlerRequest.CommitID} Source processes for source ${handlerRequest.Lookup}`
      );

      const eac: EverythingAsCodeSources & EverythingAsCode =
        handlerRequest.EaC;

      const currentSources = eac.Sources || {};

      let [sourceLookup, actionValue] =
        handlerRequest.Lookup.split('|').reverse();

      const action = actionValue as EaCSourceActionType | undefined;

      const current = currentSources[sourceLookup] || {};

      let source = handlerRequest.Model as EaCSourceAsCode;

      if (source.Details || source.SourceLookups) {
        const parentEaC: EverythingAsCodeGitHub = handlerRequest.ParentEaC!;

        const sourceConnection =
          eac.SourceConnections![
            `${(source.Details || current.Details!).Type}://${(
              source.Details || current.Details!
            ).Username!}`
          ];

        const gitHubApp =
          parentEaC.GitHubApps![sourceConnection.GitHubAppLookup!];

        const secretClient = await loadSecretClient(
          parentEaC,
          gitHubApp.CloudLookup!,
          gitHubApp.KeyVaultLookup!
        );

        const secreted = await eacGetSecrets(secretClient, {
          ClientSecret: gitHubApp.Details?.ClientSecret!,
          PrivateKey: gitHubApp.Details?.PrivateKey!,
          WebhooksSecret: gitHubApp.Details?.WebhooksSecret!,
        });

        const gitHubAppDetails = {
          ...gitHubApp.Details,
          ...secreted,
        } as EaCGitHubAppDetails;

        if (source.Details) {
          source = await ensureSource(
            gitHubAppDetails,
            sourceConnection,
            sourceLookup,
            current,
            source,
            action
          );

          sourceLookup = `${source.Details!.Type}://${
            source.Details!.Organization
          }/${source.Details!.Repository}`;

          await delay(1000);
        }

        const calls: Promise<unknown>[] = [];

        await ensureSourceSecrets(
          eac,
          gitHubAppDetails,
          sourceConnection,
          current,
          source
        );

        await delay(1000);

        await ensureSourceArtifacts(
          eac,
          gitHubAppDetails,
          sourceConnection,
          current,
          source
        );

        await Promise.all(calls);
      }

      return respond({
        Checks: [],
        Lookup: sourceLookup,
        Messages: {
          Message: `The source '${sourceLookup}' has been handled.`,
        },
        Model: source,
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
