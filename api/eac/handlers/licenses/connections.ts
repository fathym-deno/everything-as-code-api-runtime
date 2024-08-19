import { EaCRuntimeContext, EaCRuntimeHandlers } from '@fathym/eac-runtime';
import { EaCAPIUserState } from '../../../../src/state/EaCAPIUserState.ts';
import { EaCHandlerConnectionsResponse } from '../../../../src/reqres/EaCHandlerConnectionsResponse.ts';

export default {
  async POST(req, ctx: EaCRuntimeContext<EaCAPIUserState>) {
    return Response.json({
      Model: {},
    } as EaCHandlerConnectionsResponse);
  },
} as EaCRuntimeHandlers;
