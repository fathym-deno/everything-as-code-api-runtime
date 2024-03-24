// import { respond } from '@fathym/common';
// import { EaCRuntimeContext, EaCRuntimeHandlers } from '@fathym/eac/runtime';
// import { EaCAPIUserState } from '../../../../src/state/EaCAPIUserState.ts';
// import { EaCHandlerConnectionsRequest } from '../../../../src/reqres/EaCHandlerConnectionsRequest.ts';
// import { EaCDevOpsActionAsCode, EverythingAsCodeClouds, EverythingAsCodeSources } from '@fathym/eac';
// import { EaCHandlerConnectionsResponse } from '../../../../src/reqres/EaCHandlerConnectionsResponse.ts';

// export default {
//   async POST(req, ctx: EaCRuntimeContext<EaCAPIUserState>) {
//     const handlerRequest: EaCHandlerConnectionsRequest = await req.json();

//     const eac: EverythingAsCodeSources & EverythingAsCodeClouds =
//       handlerRequest.EaC;

//     return respond({
//       Model: {} as EaCDevOpsActionAsCode,
//     } as EaCHandlerConnectionsResponse);
//   },
// } as EaCRuntimeHandlers;
