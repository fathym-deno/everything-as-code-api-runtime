import { respond } from '@fathym/common';
import {
  EaCGitHubAppDetails,
  EaCGitHubAppProviderDetails,
  EaCSourceConnectionAsCode,
  EverythingAsCodeClouds,
  EverythingAsCodeGitHub,
  EverythingAsCodeIdentity,
  EverythingAsCodeSources,
} from '@fathym/eac';
import { eacGetSecrets, loadSecretClient } from '@fathym/eac/azure';
import { SimpleUser, loadOctokit } from '@fathym/eac/octokit';
import { EaCRuntimeContext, EaCRuntimeHandlers } from '@fathym/eac/runtime';
import { EaCAPIUserState } from '../../../../src/state/EaCAPIUserState.ts';
import { EaCHandlerConnectionsRequest } from '../../../../src/reqres/EaCHandlerConnectionsRequest.ts';
import { EaCHandlerConnectionsResponse } from '../../../../src/reqres/EaCHandlerConnectionsResponse.ts';

export default {
  async POST(req, ctx: EaCRuntimeContext<EaCAPIUserState>) {
    const handlerRequest: EaCHandlerConnectionsRequest = await req.json();

    const eac: EverythingAsCodeSources & EverythingAsCodeClouds =
      handlerRequest.EaC;

    const parentEaC: EverythingAsCodeIdentity & EverythingAsCodeGitHub =
      handlerRequest.ParentEaC!;

    const sourceConnDef = handlerRequest.Model as EaCSourceConnectionAsCode;

    const sourceConn = handlerRequest.Current as EaCSourceConnectionAsCode;

    const gitHubApp = parentEaC.GitHubApps![sourceConn.GitHubAppLookup!];

    const provider = parentEaC.Providers![gitHubApp.Details!.ProviderLookup];

    const secretClient = await loadSecretClient(
      parentEaC,
      gitHubApp.CloudLookup!,
      gitHubApp.KeyVaultLookup!
    );

    const details = provider.Details as EaCGitHubAppProviderDetails;

    const secreted = await eacGetSecrets(secretClient, {
      ClientSecret: details?.ClientSecret!,
      PrivateKey: details?.PrivateKey!,
      WebhooksSecret: details?.WebhooksSecret!,
    });

    const providerDetails = {
      ...details,
      ...secreted,
    } as EaCGitHubAppProviderDetails;

    const organizationLookups = Object.keys(sourceConnDef.Organizations || {});

    const [_type, username] = handlerRequest.Lookup.split('://');

    const organizations: Record<
      string,
      Record<
        string,
        {
          Branches: string[];
        }
      >
    > = {
      // [username]: {},
    };

    const query = `query paginate($cursor: String) {
      viewer {
        organizations(first: 100, after: $cursor) {
          nodes {
            login
          }
          pageInfo {
            endCursor
            hasNextPage
          }
        }
      }
    }`;

    try {
      const octokit = await loadOctokit(providerDetails, gitHubApp.Details!, sourceConn.Details!);

      const installs =
        await octokit.rest.apps.listInstallationsForAuthenticatedUser();

      installs.data.installations.forEach((installation) => {
        const account = installation.account! as SimpleUser;

        organizations[account.login] = {};
      });
    } catch (err) {
      err.toString();
    }

    return respond({
      Model: {
        Organizations: organizations,
      } as EaCSourceConnectionAsCode,
    } as EaCHandlerConnectionsResponse);
  },
} as EaCRuntimeHandlers;
