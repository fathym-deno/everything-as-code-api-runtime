// import { respond } from '@fathym/common';
// import { EaCDevOpsActionAsCode, EverythingAsCodeSources } from '@fathym/eac';
// import { EaCRuntimeContext, EaCRuntimeHandlers } from '@fathym/eac/runtime';
// import { EaCAPIUserState } from '../../../../src/state/EaCAPIUserState.ts';
// import { EaCHandlerResponse } from '../../../../src/reqres/EaCHandlerResponse.ts';
// import { EaCHandlerRequest } from '../../../../src/reqres/EaCHandlerRequest.ts';

// export default {
//   async POST(req, ctx: EaCRuntimeContext<EaCAPIUserState>) {
//     const handlerRequest: EaCHandlerRequest = await req.json();

//     console.log(
//       `Processing EaC commit ${handlerRequest.CommitID} DevOps Action processes for action ${handlerRequest.Lookup}`,
//     );

//     const eac: EverythingAsCodeSources = handlerRequest.EaC;

//     const currentDOAs = eac.SourceConnections || {};

//     const doaLookup = handlerRequest.Lookup;

//     const current = currentDOAs[doaLookup] || {};

//     const doa = handlerRequest.Model as EaCDevOpsActionAsCode;

//     return respond({
//       Checks: [],
//       Lookup: doaLookup,
//       Messages: {
//         Message: `The DevOps Action '${doaLookup}' has been handled.`,
//       },
//       Model: doa,
//     } as EaCHandlerResponse);
//   },
// } as EaCRuntimeHandlers;
