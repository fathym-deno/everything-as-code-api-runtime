import {
  EaCAPIProcessor,
  EaCDenoKVDatabaseDetails,
  EaCJWTValidationModifierDetails,
  EaCKeepAliveModifierDetails,
  EaCLocalDistributedFileSystem,
} from '@fathym/eac';
import {
  EaCRuntimeConfig,
  EaCRuntimePlugin,
  EaCRuntimePluginConfig,
  FathymAzureContainerCheckPlugin,
} from '@fathym/eac/runtime';

export default class EaCAPIPlugin implements EaCRuntimePlugin {
  constructor() {}

  public Build(config: EaCRuntimeConfig): Promise<EaCRuntimePluginConfig> {
    console.log(config);
    const pluginConfig: EaCRuntimePluginConfig = {
      Name: 'EaCAPIPlugin',
      Plugins: [new FathymAzureContainerCheckPlugin()],
      EaC: {
        Projects: {
          api: {
            Details: {
              Name: 'EaC API',
              Description: 'The EaC API Micro Application to use.',
              Priority: 100,
            },
            ResolverConfigs: {
              dev: {
                Hostname: 'localhost',
                Port: config.Server.port || 8000,
              },
              dev2: {
                Hostname: '127.0.0.1',
                Port: config.Server.port || 8000,
              },
              eacApi: {
                Hostname: 'eac-api.fathym.com',
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
        DFS: {
          'local:api/eac': {
            Type: 'Local',
            FileRoot: './api/eac/',
            DefaultFile: 'index.ts',
            Extensions: ['ts'],
          } as EaCLocalDistributedFileSystem,
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
              Description: 'The Deno KV database to use for storing EaC information',
              DenoKVPath: Deno.env.get('EAC_DENO_KV_PATH') || undefined,
            } as EaCDenoKVDatabaseDetails,
          },
          commit: {
            Details: {
              Type: 'DenoKV',
              Name: 'EaC Commit DenoKV',
              Description: 'The Deno KV database to use for the commit processing of an EaC',
              DenoKVPath: Deno.env.get('EAC_COMMIT_DENO_KV_PATH') || undefined,
            } as EaCDenoKVDatabaseDetails,
          },
        },
      },
    };

    return Promise.resolve(pluginConfig);
  }
}
