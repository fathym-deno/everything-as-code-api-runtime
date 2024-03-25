import { respond } from '@fathym/common';
import { EaCSecretAsCode, EverythingAsCode } from '@fathym/eac';
import { eacGetSecrets, loadSecretClient } from '@fathym/eac/azure';
import { EaCRuntimeContext, EaCRuntimeHandlers } from '@fathym/eac/runtime';
import { EaCHandlerConnectionsResponse } from '../../../../src/reqres/EaCHandlerConnectionsResponse.ts';
import { EaCHandlerConnectionsRequest } from '../../../../src/reqres/EaCHandlerConnectionsRequest.ts';
import { EaCAPIUserState } from '../../../../src/state/EaCAPIUserState.ts';

export default {
  async POST(req, ctx: EaCRuntimeContext<EaCAPIUserState>) {
    const handlerRequest: EaCHandlerConnectionsRequest = await req.json();

    const eac: EverythingAsCode = handlerRequest.EaC;

    const parentEaC: EverythingAsCode = handlerRequest.ParentEaC!;

    const secretDef = handlerRequest.Model as EaCSecretAsCode;

    const secret = handlerRequest.Current as EaCSecretAsCode;

    const secretClient = await loadSecretClient(
      eac,
      secretDef.CloudLookup || secret.CloudLookup!,
      secretDef.KeyVaultLookup || secret.KeyVaultLookup!
    );

    const secreted = await eacGetSecrets(secretClient, {
      Value: secretDef.Details?.Value || secret.Details!.Value!,
    });

    return respond({
      Model: {
        Details: {
          Value: secreted.Value,
        },
      } as EaCSecretAsCode,
    } as EaCHandlerConnectionsResponse);
  },
} as EaCRuntimeHandlers;
