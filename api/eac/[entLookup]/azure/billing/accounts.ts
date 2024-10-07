import { loadAzureCredentialsForToken } from '@fathym/eac/utils/azure';
import { EaCRuntimeContext, EaCRuntimeHandlers } from '@fathym/eac-runtime';
import {
  BillingAccount,
  BillingManagementClient,
} from 'npm:@azure/arm-billing';
import { EaCAPIUserState } from '../../../../../src/state/EaCAPIUserState.ts';

export default {
  async GET(req, ctx: EaCRuntimeContext<EaCAPIUserState>) {
    const entLookup = ctx.State.UserEaC!.EnterpriseLookup;

    const azureAccessToken = req.headers.get('x-eac-azure-access-token')!;

    const creds = await loadAzureCredentialsForToken(azureAccessToken);

    const billingAccounts: BillingAccount[] = [];

    if (creds) {
      try {
        const subscriptionId = '00000000-0000-0000-0000-000000000000';

        const billingClient = new BillingManagementClient(
          creds,
          subscriptionId
        );

        const expandProps = [
          'billingProfiles',
          'billingProfiles/invoiceSections',
          'customers',
          'enrollmentAccounts',
        ];

        const billingAccountsList = billingClient.billingAccounts.list({
          expand: expandProps.join(','),
        });

        for await (const billingAccount of billingAccountsList) {
          billingAccounts.push(billingAccount);
        }
      } catch (err) {
        ctx.Runtime.Logs.Package.error(
          'There was an error loading the billing accounts.',
          err
        );
      }
    }

    return Response.json(billingAccounts);
  },
} as EaCRuntimeHandlers;
