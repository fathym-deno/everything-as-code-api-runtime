import { EaCCloudAsCode, EaCCloudAzureDetails, EverythingAsCodeClouds } from '@fathym/eac/clouds';
import {
  EaCDeviceAsCode,
  EaCDeviceDetails,
  EaCIoTAsCode,
  EverythingAsCodeIoT,
} from '@fathym/eac/iot';
import { loadAzureCloudCredentials } from '@fathym/eac/utils/azure';
import { Logger } from '@std/log';
import { IotHubClient } from 'npm:@azure/arm-iothub';
import { Registry as IoTRegistry } from 'npm:azure-iothub';
import { EnsureIoTDevicesResponse } from '../reqres/EnsureIoTDevicesResponse.ts';

export async function ensureIoTDevices(
  logger: Logger,
  cloud: EaCCloudAsCode,
  currentIoT: EaCIoTAsCode,
  iot: EaCIoTAsCode,
): Promise<EnsureIoTDevicesResponse | null> {
  if (iot.Devices) {
    const details = cloud.Details as EaCCloudAzureDetails;

    const creds = await loadAzureCloudCredentials(cloud);

    const iotClient = new IotHubClient(creds, details.SubscriptionID);

    const resGroupName = currentIoT.ResourceGroupLookup!;

    const shortName = resGroupName
      .split('-')
      .map((p) => p.charAt(0))
      .join('');

    const iotHubName = `${shortName}-iot-hub`;

    const keyName = 'iothubowner';

    const keys = await iotClient.iotHubResource.getKeysForKeyName(
      resGroupName,
      iotHubName,
      keyName,
    );

    const iotHubConnStr =
      `HostName=${iotHubName}.azure-devices.net;SharedAccessKeyName=${keyName};SharedAccessKey=${keys.secondaryKey}`;

    const iotRegistry = IoTRegistry.fromConnectionString(iotHubConnStr);

    const deviceLookups = Object.keys(iot.Devices || {});

    const deviceRequestCalls = deviceLookups.map(async (deviceLookup) => {
      const device = iot.Devices![deviceLookup];

      const deviceDetails: EaCDeviceDetails = device.Details!;

      try {
        await iotRegistry.get(deviceLookup);

        return null;
      } catch (err) {
        logger.error('There was an error ensuring the IoT device', err);

        if (err.name !== 'DeviceNotFoundError') {
          throw err;
        }
      }

      return {
        deviceId: deviceLookup,
        capabilities: {
          iotEdge: deviceDetails.IsIoTEdge,
        },
      };
    });

    const deviceRequests = await Promise.all(deviceRequestCalls);

    const addDevices = deviceRequests
      .filter((deviceReq) => deviceReq)
      .map((deviceReq) => deviceReq!);

    const addDevicesResp = addDevices.length > 0 ? await iotRegistry.addDevices(addDevices) : null;

    return (addDevicesResp?.responseBody.errors || []).reduce(
      (result, error) => {
        result[error.deviceId] = {
          Error: error.errorCode.message,
          ErrorStatus: error.errorStatus,
        };

        return result;
      },
      {} as EnsureIoTDevicesResponse,
    );
  } else {
    return null;
  }
}

export async function loadIoTDevicesConnections(
  currentEaC: EverythingAsCodeIoT & EverythingAsCodeClouds,
  iot: EaCIoTAsCode,
  devicesDef: Record<string, EaCDeviceAsCode>,
  devices: Record<string, EaCDeviceAsCode>,
  deviceLookups: string[],
): Promise<Record<string, EaCDeviceAsCode>> {
  const cloud = currentEaC.Clouds![iot.CloudLookup!];

  const creds = await loadAzureCloudCredentials(cloud);

  const details = cloud.Details as EaCCloudAzureDetails;

  const iotClient = new IotHubClient(creds, details.SubscriptionID);

  const resGroupName = iot.ResourceGroupLookup!;

  const shortName = resGroupName
    .split('-')
    .map((p) => p.charAt(0))
    .join('');

  const iotHubName = `${shortName}-iot-hub`;

  const keyName = 'iothubowner';

  const keys = await iotClient.iotHubResource.getKeysForKeyName(
    resGroupName,
    iotHubName,
    keyName,
  );

  const iotHubConnStr =
    `HostName=${iotHubName}.azure-devices.net;SharedAccessKeyName=${keyName};SharedAccessKey=${keys.primaryKey}`;

  const iotRegistry = IoTRegistry.fromConnectionString(iotHubConnStr);

  const mappedCalls = deviceLookups!.map(async (deviceLookup) => {
    const _deviceDef = devicesDef ? devicesDef[deviceLookup] : {};

    const _device = devices![deviceLookup];

    const azureDevice = await iotRegistry.get(deviceLookup);

    return {
      DeviceLookup: deviceLookup,
      Device: {
        Keys: azureDevice.responseBody.authentication?.symmetricKey,
      },
    };
  }, {});

  const mapped = await Promise.all(mappedCalls);

  return mapped.reduce((dvcs, dev) => {
    dvcs[dev.DeviceLookup] = dev.Device;

    return dvcs;
  }, {} as Record<string, EaCDeviceAsCode>);
}
