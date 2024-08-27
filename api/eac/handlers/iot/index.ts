import { EverythingAsCodeClouds } from '@fathym/eac/clouds';
import { EaCIoTAsCode, EverythingAsCodeIoT } from '@fathym/eac/iot';
import { EaCRuntimeContext, EaCRuntimeHandlers } from '@fathym/eac-runtime';
import { EaCHandlerErrorResponse } from '../../../../src/reqres/EaCHandlerErrorResponse.ts';
import { EaCHandlerResponse } from '../../../../src/reqres/EaCHandlerResponse.ts';
import { EaCHandlerRequest } from '../../../../src/reqres/EaCHandlerRequest.ts';
import { EaCAPIUserState } from '../../../../src/state/EaCAPIUserState.ts';
import { ensureIoTDevices } from '../../../../src/eac/iot.helpers.ts';
import { EaCAPILoggingProvider } from '../../../../src/plugins/EaCAPILoggingProvider.ts';

export default {
  async POST(req, ctx: EaCRuntimeContext<EaCAPIUserState>) {
    const logger = await ctx.Runtime.IoC.Resolve(EaCAPILoggingProvider);

    try {
      // const username = ctx.state.Username;

      const handlerRequest: EaCHandlerRequest = await req.json();

      logger.Package.debug(
        `Processing EaC commit ${handlerRequest.CommitID} IoT processes for IoT ${handlerRequest.Lookup}`
      );

      const eac: EverythingAsCodeIoT & EverythingAsCodeClouds =
        handlerRequest.EaC;

      const currentIoT = eac.IoT || {};

      const iotLookup = handlerRequest.Lookup;

      const current = currentIoT[iotLookup] || {};

      const iot = handlerRequest.Model as EaCIoTAsCode;

      const iotCloud = eac.Clouds![current.CloudLookup!];

      const devicesResp = await ensureIoTDevices(logger.Package, iotCloud, current, iot);

      if (Object.keys(devicesResp || {}).length === 0) {
        return Response.json({
          Checks: [],
          Lookup: iotLookup,
          Messages: {
            Message: `The iot '${iotLookup}' has been handled.`,
          },
          Model: iot,
        } as EaCHandlerResponse);
      } else {
        return Response.json({
          HasError: true,
          Messages: {
            Errors: devicesResp,
          },
        } as EaCHandlerErrorResponse);
      }
    } catch (err) {
      logger.Package.error(
        'There was an error configuring the IoT device',
        err
      );

      return Response.json({
        HasError: true,
        Messages: {
          Error: JSON.stringify(err),
        },
      } as EaCHandlerErrorResponse);
    }
  },
} as EaCRuntimeHandlers;
