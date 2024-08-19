import { loadAzureCredentialsForToken } from '@fathym/eac/utils/azure';
import { EaCRuntimeContext, EaCRuntimeHandlers } from '@fathym/eac-runtime';
import { Subscription, SubscriptionClient } from 'npm:@azure/arm-subscriptions';
import { EaCAPIUserState } from '../../../../../src/state/EaCAPIUserState.ts';

export default {
  async GET(req, ctx: EaCRuntimeContext<EaCAPIUserState>) {
    const entLookup = ctx.State.UserEaC!.EnterpriseLookup;

    const azureAccessToken = req.headers.get('x-eac-azure-access-token')!;

    const creds = await loadAzureCredentialsForToken(azureAccessToken);

    const subs: Subscription[] = [];

    if (creds) {
      const subClient = new SubscriptionClient(creds);

      const subsList = subClient.subscriptions.list();

      for await (const sub of subsList) {
        if (sub.state !== 'Disabled' && sub.state !== 'Deleted') {
          subs.push(sub);
        }
      }
    }

    return Response.json(subs);
  },
} as EaCRuntimeHandlers;
