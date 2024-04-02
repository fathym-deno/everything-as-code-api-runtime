import { respond } from '@fathym/common';
import {
  EaCSourceConnectionAsCode,
  EverythingAsCodeSources,
} from '@fathym/eac';
import { EaCRuntimeContext, EaCRuntimeHandlers } from '@fathym/eac/runtime';
import { EaCHandlerResponse } from '../../../../src/reqres/EaCHandlerResponse.ts';
import { EaCHandlerRequest } from '../../../../src/reqres/EaCHandlerRequest.ts';
import { EaCAPIUserState } from '../../../../src/state/EaCAPIUserState.ts';

export default {
  async POST(req, ctx: EaCRuntimeContext<EaCAPIUserState>) {
    const handlerRequest: EaCHandlerRequest = await req.json();

    console.log(
      `Processing EaC commit ${handlerRequest.CommitID} Source Connection processes for source connection ${handlerRequest.Lookup}`
    );

    const srcConnLookup = handlerRequest.Lookup;

    const srcConn = handlerRequest.Model as EaCSourceConnectionAsCode;

    return respond({
      Checks: [],
      Lookup: srcConnLookup,
      Messages: {
        Message: `The source connection '${srcConnLookup}' has been handled.`,
      },
      Model: srcConn,
    } as EaCHandlerResponse);
  },
} as EaCRuntimeHandlers;
