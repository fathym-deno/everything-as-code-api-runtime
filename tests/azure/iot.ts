import { Registry as IoTRegistry } from 'npm:azure-iothub';

Deno.test('Azure IoT', async (t) => {
  await t.step('Create Device', async () => {
    const iotHubConnStr =
      `HostName=mfrgd2-iot-hub.azure-devices.net;SharedAccessKeyName=iothubowner;SharedAccessKey=6vagMLlfrevw3l3mBJ8Cp9k0JdZanfgo8AIoTPSCedE=`;

    const iotRegistry = IoTRegistry.fromConnectionString(iotHubConnStr);

    await iotRegistry.get('sim000001');
  });
});
