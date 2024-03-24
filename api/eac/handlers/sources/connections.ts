// import { respond } from '@fathym/common';
// import { EaCSourceAsCode, EverythingAsCodeSources } from '@fathym/eac';
// import { EaCRuntimeContext, EaCRuntimeHandlers } from '@fathym/eac/runtime';
// import { EaCAPIUserState } from '../../../../src/state/EaCAPIUserState.ts';
// import { EaCHandlerConnectionsRequest } from '../../../../src/reqres/EaCHandlerConnectionsRequest.ts';
// import { EaCHandlerConnectionsResponse } from '../../../../src/reqres/EaCHandlerConnectionsResponse.ts';

// export default {
//   async POST(req, ctx: EaCRuntimeContext<EaCAPIUserState>) {
//     const handlerRequest: EaCHandlerConnectionsRequest = await req.json();

//     const eac: EverythingAsCodeSources = handlerRequest.EaC;

//     const sourceDef = handlerRequest.Model as EaCSourceAsCode;

//     return respond({
//       Model: {} as EaCSourceAsCode,
//     } as EaCHandlerConnectionsResponse);
//   },
// } as EaCRuntimeHandlers;
