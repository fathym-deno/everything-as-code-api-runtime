import {
  EaCAPIProcessor,
  EaCJWTValidationModifierDetails,
  EaCKeepAliveModifierDetails,
} from '@fathym/eac/applications';
import { EaCDenoKVDatabaseDetails } from '@fathym/eac/databases';
import { EaCLocalDistributedFileSystemDetails } from '@fathym/eac/dfs';
import {
  EaCRuntimeConfig,
  EaCRuntimePlugin,
  EaCRuntimePluginConfig,
  FathymAzureContainerCheckPlugin,
} from '@fathym/eac-runtime';
import { IoCContainer } from '@fathym/ioc';
import { EaCAPILoggingProvider } from './EaCAPILoggingProvider.ts';

export default class EaCAPIPlugin implements EaCRuntimePlugin {
  constructor() {}

  public Setup(config: EaCRuntimeConfig): Promise<EaCRuntimePluginConfig> {
    const pluginConfig: EaCRuntimePluginConfig = {
      Name: 'EaCAPIPlugin',
      Plugins: [new FathymAzureContainerCheckPlugin()],
      IoC: new IoCContainer(),
      EaC: {
        Projects: {
          api: {
            Details: {
              Name: 'EaC API',
              Description: 'The EaC API Micro Application to use.',
              Priority: 100,
            },
            ResolverConfigs: {
              localhost: {
                Hostname: 'localhost',
                Port: config.Server.port || 8000,
              },
              '127.0.0.1': {
                Hostname: '127.0.0.1',
                Port: config.Server.port || 8000,
              },
              'host.docker.internal': {
                Hostname: 'host.docker.internal',
                Port: config.Server.port || 8000,
              },
              'eac-api.fathym.com': {
                Hostname: 'eac-api.fathym.com',
              },
              'everything-as-code-api-runtime.azurewebsites.net': {
                Hostname: 'everything-as-code-api-runtime.azurewebsites.net',
              },
            },
            ModifierResolvers: {
              keepAlive: {
                Priority: 1000,
              },
            },
            ApplicationResolvers: {
              api: {
                PathPattern: '/api/eac*',
                Priority: 100,
              },
              azureContainerCheck: {
                PathPattern: '*',
                Priority: 100,
              },
            },
          },
        },
        Applications: {
          api: {
            Details: {
              Name: 'API Endpoints',
              Description: 'The API endpoints to use for the project.',
            },
            ModifierResolvers: {
              jwtValidate: {
                Priority: 900,
              },
            },
            Processor: {
              Type: 'API',
              DFSLookup: 'local:api/eac',
            } as EaCAPIProcessor,
          },
        },
        DFSs: {
          'local:api/eac': {
            Details: {
              Type: 'Local',
              FileRoot: './api/eac/',
              DefaultFile: 'index.ts',
              Extensions: ['ts'],
            } as EaCLocalDistributedFileSystemDetails,
          },
        },
        Modifiers: {
          jwtValidate: {
            Details: {
              Type: 'JWTValidation',
              Name: 'Validate JWT',
              Description: 'Validate incoming JWTs to restrict access.',
            } as EaCJWTValidationModifierDetails,
          },
          keepAlive: {
            Details: {
              Type: 'KeepAlive',
              Name: 'Keep Alive',
              Description: 'Modifier to support a keep alive workflow.',
              KeepAlivePath: '/_eac/alive',
            } as EaCKeepAliveModifierDetails,
          },
        },
        Databases: {
          eac: {
            Details: {
              Type: 'DenoKV',
              Name: 'EaC DenoKV',
              Description:
                'The Deno KV database to use for storing EaC information',
              DenoKVPath: Deno.env.get('EAC_DENO_KV_PATH') || undefined,
            } as EaCDenoKVDatabaseDetails,
          },
          commit: {
            Details: {
              Type: 'DenoKV',
              Name: 'EaC Commit DenoKV',
              Description:
                'The Deno KV database to use for the commit processing of an EaC',
              DenoKVPath: Deno.env.get('EAC_COMMIT_DENO_KV_PATH') || undefined,
            } as EaCDenoKVDatabaseDetails,
          },
        },
      },
    };

    pluginConfig.IoC!.Register(
      EaCAPILoggingProvider,
      () => new EaCAPILoggingProvider()
    );

    return Promise.resolve(pluginConfig);
  }
}
