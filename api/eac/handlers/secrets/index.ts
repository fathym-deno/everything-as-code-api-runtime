import { merge, respond } from '@fathym/common';
import {
  EaCSecretAsCode,
  EverythingAsCode,
  EverythingAsCodeClouds,
  eacSetSecrets,
  loadSecretClient,
} from '@fathym/eac';
import { EaCRuntimeContext, EaCRuntimeHandlers } from '@fathym/eac/runtime';
import { EaCHandlerResponse } from '../../../../src/reqres/EaCHandlerResponse.ts';
import { resolveDynamicValues } from '../../../../src/utils/eac/resolveDynamicValues.ts';
import { EaCHandlerRequest } from '../../../../src/reqres/EaCHandlerRequest.ts';
import { EaCAPIUserState } from '../../../../src/state/EaCAPIUserState.ts';

export default {
  async POST(req, ctx: EaCRuntimeContext<EaCAPIUserState>) {
    const handlerRequest: EaCHandlerRequest = await req.json();

    console.log(
      `Processing EaC commit ${handlerRequest.CommitID} Secret processes for secret ${handlerRequest.Lookup}`
    );

    const eac: EverythingAsCodeClouds & EverythingAsCode = handlerRequest.EaC;

    const currentSecrets = eac.Secrets || {};

    const secretLookup = handlerRequest.Lookup;

    const current = currentSecrets[secretLookup] || {};

    const secretDef = handlerRequest.Model as EaCSecretAsCode;

    let secretValue = secretDef.Details?.Value;

    if (secretValue && !secretValue.startsWith('$secret:')) {
      const eacKv = await ctx.Runtime.IoC.Resolve<Deno.Kv>(Deno.Kv, 'eac');

      const resolved = await resolveDynamicValues(
        eacKv,
        {
          SecretValue: secretValue,
        },
        eac,
        ctx.State.JWT!
      );

      secretValue = resolved.SecretValue;

      const secretClient = await loadSecretClient(
        eac,
        secretDef.CloudLookup || current.CloudLookup!,
        secretDef.KeyVaultLookup || current.KeyVaultLookup!
      );

      const secreted = await eacSetSecrets(secretClient, secretLookup, {
        Value: secretValue,
      });

      secretDef.Details = merge(current.Details!, {
        Value: secreted.Value,
      });
    }

    return respond({
      Checks: [],
      Lookup: secretLookup,
      Messages: {
        Message: `The secret '${secretLookup}' has been handled.`,
      },
      Model: secretDef,
    } as EaCHandlerResponse);
  },
} as EaCRuntimeHandlers;
