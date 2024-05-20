import { respond } from '@fathym/common';
import {
  EaCIoTAsCode,
  EverythingAsCodeClouds,
  EverythingAsCodeIoT,
} from '@fathym/eac';
import { EaCRuntimeContext, EaCRuntimeHandlers } from '@fathym/eac/runtime';
import { EaCAPIUserState } from '../../../../src/state/EaCAPIUserState.ts';
import { EaCHandlerConnectionsRequest } from '../../../../src/reqres/EaCHandlerConnectionsRequest.ts';
import { EaCHandlerConnectionsResponse } from '../../../../src/reqres/EaCHandlerConnectionsResponse.ts';
import { loadIoTDevicesConnections } from '../../../../src/eac/iot.helpers.ts';

export default {
  async POST(req, ctx: EaCRuntimeContext<EaCAPIUserState>) {
    return respond({
      Model: {},
    } as EaCHandlerConnectionsResponse);
  },
} as EaCRuntimeHandlers;
