// import { respond } from '@fathym/common';
// import { EaCGitHubAppAsCode, EverythingAsCodeGitHub } from '@fathym/eac';
// import { EaCRuntimeContext, EaCRuntimeHandlers } from '@fathym/eac/runtime';
// import { EaCAPIUserState } from '../../../../src/state/EaCAPIUserState.ts';
// import { EaCHandlerConnectionsRequest } from '../../../../src/reqres/EaCHandlerConnectionsRequest.ts';
// import { EaCHandlerConnectionsResponse } from '../../../../src/reqres/EaCHandlerConnectionsResponse.ts';

// export default {
//   async POST(req, ctx: EaCRuntimeContext<EaCAPIUserState>) {
//     const handlerRequest: EaCHandlerConnectionsRequest = await req.json();

//     const eac: EverythingAsCodeGitHub = handlerRequest.EaC;

//     const sourceDef = handlerRequest.Model as EaCGitHubAppAsCode;

//     return respond({
//       Model: {} as EaCGitHubAppAsCode,
//     } as EaCHandlerConnectionsResponse);
//   },
// } as EaCRuntimeHandlers;
