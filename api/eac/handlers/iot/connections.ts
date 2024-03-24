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
    const handlerRequest: EaCHandlerConnectionsRequest = await req.json();

    const eac: EverythingAsCodeIoT & EverythingAsCodeClouds =
      handlerRequest.EaC;

    const iotDef = handlerRequest.Model as EaCIoTAsCode;

    let deviceLookups = Object.keys(iotDef.Devices || {});

    const iot = handlerRequest.Current as EaCIoTAsCode;

    if (deviceLookups.length === 0) {
      deviceLookups = Object.keys(iot.Devices || {});
    }

    return respond({
      Model: {
        Devices: await loadIoTDevicesConnections(
          eac,
          iot,
          iotDef.Devices!,
          iot.Devices!,
          deviceLookups
        ),
      } as EaCIoTAsCode,
    } as EaCHandlerConnectionsResponse);
  },
} as EaCRuntimeHandlers;
