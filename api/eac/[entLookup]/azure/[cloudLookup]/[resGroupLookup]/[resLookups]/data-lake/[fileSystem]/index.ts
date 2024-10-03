import { EverythingAsCodeClouds } from '@fathym/eac/clouds';
import { loadDataLakeClient } from '@fathym/eac/utils/azure';
import { EaCRuntimeContext, EaCRuntimeHandlers } from '@fathym/eac-runtime';
import { FileReadResponse } from 'npm:@azure/storage-file-datalake';
import { parse as json2csv } from 'npm:json2csv';
import { EaCAPIUserState } from '../../../../../../../../../src/state/EaCAPIUserState.ts';
import { EaCAPILoggingProvider } from '../../../../../../../../../src/logging/EaCAPILoggingProvider.ts';

export const flattenJson = (function (isArray, wrapped) {
  return function (table: any) {
    return reduce('', {}, table);
  };

  function reduce(
    path: string,
    accumulator: Record<string, unknown>,
    table: any
  ) {
    if (isArray(table)) {
      const length = table.length;

      if (length) {
        let index = 0;

        while (index < length) {
          const property = path + '[' + index + ']';

          const item = table[index++];

          if (wrapped(item) !== item) {
            accumulator[property] = item;
          } else {
            reduce(property, accumulator, item);
          }
        }
      } else {
        accumulator[path] = table;
      }
    } else {
      let empty = true;

      if (path) {
        for (let property in table) {
          const item: any = table[property];

          property = path + '.' + property;

          empty = false;

          if (wrapped(item) !== item) {
            accumulator[property] = item;
          } else {
            reduce(property, accumulator, item);
          }
        }
      } else {
        for (const property in table) {
          const item = table[property];

          empty = false;

          if (wrapped(item) !== item) {
            accumulator[property] = item;
          } else {
            reduce(property, accumulator, item);
          }
        }
      }

      if (empty) {
        accumulator[path] = table;
      }
    }

    return accumulator;
  }
})(Array.isArray, Object);

export default {
  async GET(req, ctx: EaCRuntimeContext<EaCAPIUserState>) {
    const logger = ctx.Runtime.Logs;

    const entLookup = ctx.State.UserEaC!.EnterpriseLookup;

    const cloudLookup = ctx.Params.cloudLookup as string;

    const resGroupLookup = ctx.Params.resGroupLookup as string;

    const resLookups: string[] = decodeURIComponent(
      ctx.Params.resLookups as string
    ).split('|');

    const fileSystem = ctx.Params.fileSystem as string;

    const shortName = resGroupLookup
      .split('-')
      .map((p) => p.charAt(0))
      .join('');

    const iotHubName = `${shortName}-iot-hub`;

    const url = new URL(req.url);

    const svcSuffix = url.searchParams.get('svcSuffix') as string | undefined;

    const startTime = new Date(
      Date.parse(
        url.searchParams.get('startTime') ||
          new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toUTCString()
      )
    );

    const endTime = new Date(
      Date.parse(
        url.searchParams.get('endTime') || new Date(Date.now()).toUTCString()
      )
    );

    const resultType = url.searchParams.get('resultType') as
      | 'json'
      | 'csv'
      | 'jsonl';

    const flatten = JSON.parse(
      url.searchParams.get('flatten') || 'false'
    ) as boolean;

    const download = JSON.parse(
      url.searchParams.get('download') || 'false'
    ) as boolean;

    const dataLakeClient = await loadDataLakeClient(
      entLookup,
      cloudLookup,
      resGroupLookup,
      resLookups,
      async (entLookup) => {
        const eacKv = await ctx.Runtime.IoC.Resolve<Deno.Kv>(Deno.Kv, 'eac');

        const eac = await eacKv.get<EverythingAsCodeClouds>([
          'EaC',
          'Current',
          entLookup,
        ]);

        return eac.value!;
      },
      svcSuffix
    );

    const fileSystemClient = dataLakeClient.getFileSystemClient(fileSystem);

    const body = new ReadableStream({
      async start(controller) {
        const fileSystemPaths = fileSystemClient.listPaths({
          path: iotHubName,
          recursive: true,
        });

        let csvHeadersSent = false;

        for await (const fileSystemPath of fileSystemPaths) {
          // const pattern = new URLPattern({ pathname: '*' });
          const pattern = new URLPattern({
            pathname: `/${iotHubName}/:partition/:year/:month/:day/:hour/:minute.json`,
          });

          const filePattern = pattern.exec(
            `https://notused.com/${fileSystemPath.name!}`
          );

          if (filePattern) {
            const { year, month, day, hour, minute } =
              filePattern.pathname.groups;

            const fileTime = new Date(
              Date.UTC(
                Number.parseInt(year!),
                Number.parseInt(month!) - 1,
                Number.parseInt(day!),
                Number.parseInt(hour!),
                Number.parseInt(minute!)
              )
            );

            if (
              startTime.getTime() <= fileTime.getTime() &&
              fileTime.getTime() <= endTime.getTime()
            ) {
              const fileClient = fileSystemClient.getFileClient(
                fileSystemPath.name!
              );

              if (
                (resultType === 'jsonl' || resultType === 'json') &&
                !flatten
              ) {
                controller.enqueue(await fileClient.readToBuffer());
              } else {
                const fileResp: FileReadResponse = await fileClient.read();

                if (fileResp.readableStreamBody) {
                  const streamToBody = async (
                    readableStream: NodeJS.ReadableStream
                  ) => {
                    return new Promise<void>((resolve, reject) => {
                      let buffer: number[] = [];

                      readableStream.on('data', (data: Uint8Array) => {
                        if (buffer.length > 0) {
                          buffer.push(...data);
                        }

                        const items = new TextDecoder()
                          .decode(
                            buffer.length > 0 ? new Uint8Array(buffer) : data
                          )
                          .split('\n');

                        buffer = [];

                        const lastItem = items.pop()!;

                        try {
                          JSON.parse(lastItem);

                          items.push(lastItem);
                        } catch (err) {
                          buffer.push(...new TextEncoder().encode(lastItem));
                        }

                        if (items.length > 0) {
                          items.forEach((item) => {
                            if (item === '\r') {
                              return;
                            }
                            if (flatten || resultType === 'csv') {
                              try {
                                item = JSON.stringify(
                                  flattenJson(JSON.parse(item))
                                );
                              } catch (err) {
                                throw err;
                              }
                            }

                            if (resultType === 'csv') {
                              item = json2csv([JSON.parse(item)], {
                                expandNestedObjects: false,
                                keys: [],
                                header: !csvHeadersSent,
                              });

                              csvHeadersSent = true;
                            } else if (resultType === 'json') {
                              // TODO(mcgear): Implement JSONPatch mechanism for JSON object constructionon the client?
                            }

                            controller.enqueue(
                              new TextEncoder().encode(`${item}\n`)
                            );
                          });
                        }
                      });

                      readableStream.on('end', () => {
                        resolve();
                      });

                      readableStream.on('error', reject);
                    });
                  };

                  await streamToBody(fileResp.readableStreamBody);
                }
              }
            }
          }
        }

        controller.close();
      },
      cancel() {
        // divined.cancel();
      },
    });

    const headers = new Headers();

    if (download) {
      headers.set(
        'Content-Disposition',
        `attachment; filename=${startTime.toISOString()}-${endTime.toISOString()}.${resultType}`
      );

      if (resultType === 'csv') {
        headers.set('Content-Type', 'text/csv');
      } else if (resultType === 'json') {
        headers.set('Content-Type', 'application/json');
      } else if (resultType === 'jsonl') {
        headers.set('Content-Type', 'application/jsonl');
      }
    } else {
      headers.set('Content-Disposition', 'inline');

      headers.set('Content-Type', 'text/plain');
    }

    headers.set('Cache-Control', 'no-cache no-store');

    return new Response(body, {
      headers: headers,
    });
  },
} as EaCRuntimeHandlers;
