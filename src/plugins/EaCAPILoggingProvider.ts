import { LoggingProvider } from '@fathym/common/log';
import { ConsoleHandler, LevelName, Logger, LoggerConfig } from '@std/log';

export class EaCAPILoggingProvider extends LoggingProvider {
  public get Default(): Logger {
    return this.LoggerSync();
  }

  public get Package(): Logger {
    return this.LoggerSync(undefined, true);
  }

  constructor() {
    const loggingPackages = [
      '@fathym/common/build',
      '@fathym/common/deno-kv',
      '@fathym/common/path',
      '@fathym/eac',
      '@fathym/eac-api/client',
      '@fathym/eac-runtime',
      '@fathym/atomic-icons',
    ];

    super({
      handlers: {
        console: new ConsoleHandler('DEBUG'),
      },
      loggers: {
        default: {
          level: (Deno.env.get('LOGGING_DEFAULT_LEVEL') as LevelName) ?? 'DEBUG',
          handlers: ['console'],
        },

        '@fathym/everything-as-code-api-runtime': {
          level: (Deno.env.get('LOGGING_DEFAULT_LEVEL') as LevelName) ?? 'DEBUG',
          handlers: ['console'],
        },

        ...loggingPackages.reduce((acc, name) => {
          const logLevelName = Deno.env.get('LOGGING_PACKAGE_LEVEL') ??
            Deno.env.get('LOGGING_DEFAULT_LEVEL') ??
            'DEBUG';

          acc[name] = {
            level: logLevelName as LevelName,
            handlers: ['console'],
          };
          return acc;
        }, {} as Record<string, LoggerConfig>),
      },
    });
  }
}
