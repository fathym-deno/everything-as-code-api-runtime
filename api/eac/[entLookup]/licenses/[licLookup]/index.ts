import {
  EaCLicenseStripeDetails,
  EverythingAsCodeLicensing,
} from '@fathym/eac/licensing';
import { UserEaCLicense } from '@fathym/eac-api';
import { EaCRuntimeHandlers } from '@fathym/eac-runtime';
import { Stripe } from 'npm:stripe';
import { EaCAPIUserState } from '../../../../../src/state/EaCAPIUserState.ts';
import { STATUS_CODE } from '@std/http/status';
import { eacGetSecrets, loadMainSecretClient } from '@fathym/eac/utils/azure';
import { EaCAPILoggingProvider } from '../../../../../src/logging/EaCAPILoggingProvider.ts';

export default {
  async GET(req, ctx) {
    const entLookup = ctx.State.UserEaC!.EnterpriseLookup;

    const url = new URL(req.url);

    const username = url.searchParams.get('username')!;

    const licLookup = ctx.Params.licLookup as string;

    const eacKv = await ctx.Runtime.IoC.Resolve<Deno.Kv>(Deno.Kv, 'eac');

    const licenses = await eacKv.get<Record<string, UserEaCLicense>>([
      'EaC',
      'Current',
      entLookup,
      'Licenses',
      username,
    ]);

    const userLicense = licenses.value?.[licLookup];

    if (userLicense) {
      const eac = await eacKv.get<EverythingAsCodeLicensing>([
        'EaC',
        'Current',
        entLookup,
      ]);

      const eacLicense = eac.value?.Licenses?.[licLookup];

      if (eacLicense) {
        let stripeDetails = eacLicense.Details as EaCLicenseStripeDetails;

        const secretClient = await loadMainSecretClient();

        const secreted = await eacGetSecrets(secretClient, {
          PublishableKey: stripeDetails.PublishableKey,
          SecretKey: stripeDetails.SecretKey,
          WebhookSecret: stripeDetails.WebhookSecret,
        });

        stripeDetails = {
          ...stripeDetails,
          ...secreted,
        };

        const stripe = (Stripe as any)(stripeDetails.SecretKey)!;

        const customers = await stripe.customers.search({
          query: `email:"${username}"`,
          limit: 1,
        });

        let customer = customers.data[0];

        if (customer) {
          const subs = await stripe.subscriptions.search({
            query: [
              `metadata["customer"]:"${customer.id}"`,
              `metadata["license"]:"${licLookup}"`,
            ].join(' AND '),
            limit: 1,
            expand: ['data.latest_invoice.payment_intent'],
          });

          const sub = subs.data[0];

          const validStati = ['trialing', 'active'];

          const res = {
            Active: sub && validStati.some((vs) => vs === sub.status),
            License: userLicense,
            Subscription: sub,
          };

          return Response.json(res);
        }
      }
    }

    return Response.json({ Active: false });
  },

  async POST(req, ctx) {
    const logger = await ctx.Runtime.IoC.Resolve(EaCAPILoggingProvider);

    const entLookup = ctx.State.UserEaC!.EnterpriseLookup;

    const url = new URL(req.url);

    const username = url.searchParams.get('username')!;

    const licLookup = ctx.Params.licLookup as string;

    const licReq: UserEaCLicense = await req.json();

    const eacKv = await ctx.Runtime.IoC.Resolve<Deno.Kv>(Deno.Kv, 'eac');

    let licenses = (
      await eacKv.get<Record<string, UserEaCLicense>>([
        'EaC',
        'Current',
        entLookup,
        'Licenses',
        username,
      ])
    ).value;

    if (!licenses) {
      licenses = {};
    }

    const eac = await eacKv.get<EverythingAsCodeLicensing>([
      'EaC',
      'Current',
      entLookup,
    ]);

    const eacLicense = eac.value?.Licenses?.[licLookup];

    if (eacLicense) {
      let stripeDetails = eacLicense.Details as EaCLicenseStripeDetails;

      const secretClient = await loadMainSecretClient();

      const secreted = await eacGetSecrets(secretClient, {
        PublishableKey: stripeDetails.PublishableKey,
        SecretKey: stripeDetails.SecretKey,
        WebhookSecret: stripeDetails.WebhookSecret,
      });

      stripeDetails = {
        ...stripeDetails,
        ...secreted,
      };

      const stripe: Stripe = (Stripe as any)(stripeDetails.SecretKey)!;

      try {
        const customers = await stripe.customers.search({
          query: `email:"${username}"`,
          limit: 1,
        });

        let customer = customers.data[0];

        if (!customer) {
          customer = await stripe.customers.create({
            email: username,
          });
        }

        const subs = await stripe.subscriptions.search({
          query: [
            `metadata["customer"]:"${customer.id}"`,
            `metadata["license"]:"${licLookup}"`,
            `-status:"incomplete_expired"`,
            `-status:"canceled"`,
          ].join(' AND '),
          limit: 1,
        });

        // TODO(ttrichar): Handle all of the different statis to deterimine what happens next,,,

        let sub: (typeof subs.data)[0] | undefined = subs.data[0];

        const eacPrice =
          eac.value!.Licenses![licLookup]!.Plans![licReq.PlanLookup]!.Prices![
            licReq.PriceLookup
          ]!;

        const priceKey = Math.round(eacPrice.Details!.Value * 100).toString(); // `${licLookup}-${licReq.PlanLookup}-${licReq.PriceLookup}`;

        const productId = `${licLookup}-${licReq.PlanLookup}`;

        const prices = await stripe.prices.search({
          query: `lookup_key:"${priceKey}" AND product:"${productId}"`,
          limit: 1,
        });

        const priceId = prices.data[0].id;

        if (
          sub?.status === 'incomplete' &&
          priceId !== sub.items.data[0].price.id
        ) {
          await stripe.subscriptions.cancel(sub.id);

          sub = undefined;
          // } else if (
          //   sub.status === 'canceled' &&
          //   priceId !== sub.items.data[0].price.id
          // ) {
          //   sub = await stripe.subscriptions.resume(sub.id, {});

          //   sub = undefined;
        }

        if (!sub) {
          sub = await stripe.subscriptions.create({
            customer: customer.id,
            items: [
              {
                price: priceId,
              },
            ],
            payment_behavior: 'default_incomplete',
            payment_settings: {
              save_default_payment_method: 'on_subscription',
            },
            expand: ['latest_invoice.payment_intent'],
            metadata: {
              customer: customer.id,
              license: licLookup,
            },
          });
        } else {
          sub = await stripe.subscriptions.update(sub.id, {
            items: [
              {
                id: sub.items.data[0].id,
                price: priceId,
              },
            ],
            expand: ['latest_invoice.payment_intent'],
          });
        }

        if (sub) {
          licenses[licLookup] = licReq;

          await eacKv.set(
            ['EaC', 'Current', entLookup, 'Licenses', username],
            licenses
          );

          return Response.json({
            License: licenses[licLookup],
            Subscription: sub,
          });
        }
      } catch (error) {
        logger.Package.error(
          `There was an error configuring the license '${licLookup}'`,
          error
        );

        return Response.json(error, {
          status: STATUS_CODE.BadRequest,
        });
      }
    }

    return Response.json(
      {},
      {
        status: STATUS_CODE.BadRequest,
      }
    );
  },

  async DELETE(req, ctx) {
    const entLookup = ctx.State.UserEaC!.EnterpriseLookup;

    const url = new URL(req.url);

    const username = url.searchParams.get('username')!;

    const licLookup = ctx.Params.licLookup as string;

    const eacKv = await ctx.Runtime.IoC.Resolve<Deno.Kv>(Deno.Kv, 'eac');

    let licenses = (
      await eacKv.get<Record<string, UserEaCLicense>>([
        'EaC',
        'Current',
        entLookup,
        'Licenses',
        username,
      ])
    ).value;

    if (licenses) {
      const eac = await eacKv.get<EverythingAsCodeLicensing>([
        'EaC',
        'Current',
        entLookup,
      ]);

      const eacLicense = eac.value?.Licenses?.[licLookup];

      if (eacLicense) {
        let stripeDetails = eacLicense.Details as EaCLicenseStripeDetails;

        const secretClient = await loadMainSecretClient();

        const secreted = await eacGetSecrets(secretClient, {
          PublishableKey: stripeDetails.PublishableKey,
          SecretKey: stripeDetails.SecretKey,
          WebhookSecret: stripeDetails.WebhookSecret,
        });

        stripeDetails = {
          ...stripeDetails,
          ...secreted,
        };

        const stripe = (Stripe as any)(stripeDetails.SecretKey)!;

        try {
          const customers = await stripe.customers.search({
            query: `email:"${username}"`,
            limit: 1,
          });

          let customer = customers.data[0];

          const subs = await stripe.subscriptions.search({
            query: [
              `metadata["customer"]:"${customer.id}"`,
              `metadata["license"]:"${licLookup}"`,
            ].join(' AND '),
            limit: 1,
          });

          let sub = subs.data[0];

          if (sub) {
            sub = await stripe.subscriptions.cancel(sub.id, {});
          }

          if (sub) {
            delete licenses[licLookup];

            await eacKv.set(
              ['EaC', 'Current', entLookup, 'Licenses', username],
              licenses
            );

            return Response.json({});
          }
        } catch (error) {
          return Response.json(error, {
            status: STATUS_CODE.BadRequest,
          });
        }
      }
    }

    return Response.json(
      {},
      {
        status: STATUS_CODE.BadRequest,
      }
    );
  },
} as EaCRuntimeHandlers<EaCAPIUserState>;
