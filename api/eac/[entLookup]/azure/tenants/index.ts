import { loadAzureCredentialsForToken } from '@fathym/eac/azure';
import { EaCRuntimeContext, EaCRuntimeHandlers } from '@fathym/eac/runtime';
import {
  TenantIdDescription,
  SubscriptionClient,
} from 'npm:@azure/arm-subscriptions';
import { EaCAPIUserState } from '../../../../../src/state/EaCAPIUserState.ts';
import { AzureTenanatsRequest } from '@fathym/eac/api';

export default {
  async GET(req, ctx: EaCRuntimeContext<EaCAPIUserState>) {
    const entLookup = ctx.State.UserEaC!.EnterpriseLookup;

    const azureAccessToken = req.headers.get('x-eac-azure-access-token')!;

    const creds = await loadAzureCredentialsForToken(azureAccessToken);

    const tenants: TenantIdDescription[] = [];

    if (creds) {
      const subClient = new SubscriptionClient(creds);

      const tenantsList = subClient.tenants.list();

      for await (const tenant of tenantsList) {
        tenants.push(tenant);
      }
    }

    return Response.json(tenants);
  },
} as EaCRuntimeHandlers;
