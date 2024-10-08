import { loadAzureCredentialsForToken } from '@fathym/eac/utils/azure';
import { EaCRuntimeContext, EaCRuntimeHandlers } from '@fathym/eac-runtime';
import {
  TenantIdDescription,
  SubscriptionClient,
} from 'npm:@azure/arm-subscriptions@5.1.0';
import { EaCAPIUserState } from '../../../../../src/state/EaCAPIUserState.ts';

export default {
  async GET(req, ctx: EaCRuntimeContext<EaCAPIUserState>) {
    const entLookup = ctx.State.UserEaC!.EnterpriseLookup;

    const azureAccessToken = req.headers.get('x-eac-azure-access-token')!;

    const creds = await loadAzureCredentialsForToken(azureAccessToken);

    const tenantCheck = new Promise((resolve, reject) => {
      const work = async () => {
        const tenants: TenantIdDescription[] = [];

        if (creds) {
          try {
            const subClient = new SubscriptionClient(creds);

            const tenantsList = subClient.tenants.list();

            for await (const tenant of tenantsList) {
              tenants.push(tenant);
            }

            resolve(tenants);
          } catch (err) {
            ctx.Runtime.Logs.Package.error(
              'There was an error loading the tenant.',
              err
            );

            reject(err);
          }
        } else {
          resolve(tenants);
        }
      };

      work();
    });

    return Response.json(await tenantCheck);
  },
} as EaCRuntimeHandlers;
