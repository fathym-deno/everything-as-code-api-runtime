import {
  EaCLicenseAsCode,
  EaCLicenseStripeDetails,
  EverythingAsCodeLicensing,
} from '@fathym/eac/licensing';
import { EaCRuntimeContext, EaCRuntimeHandlers } from '@fathym/eac-runtime';
import { eacSetSecrets, loadMainSecretClient } from '@fathym/eac/utils/azure';
import { Stripe } from 'npm:stripe';
import { EaCHandlerErrorResponse } from '../../../../src/reqres/EaCHandlerErrorResponse.ts';
import { EaCHandlerResponse } from '../../../../src/reqres/EaCHandlerResponse.ts';
import { EaCHandlerRequest } from '../../../../src/reqres/EaCHandlerRequest.ts';
import { EaCAPIUserState } from '../../../../src/state/EaCAPIUserState.ts';
import { EaCAPILoggingProvider } from '../../../../src/logging/EaCAPILoggingProvider.ts';

export default {
  async POST(req, ctx: EaCRuntimeContext<EaCAPIUserState>) {
    const logger = ctx.Runtime.Logs;

    try {
      const handlerRequest: EaCHandlerRequest = await req.json();

      logger.Package.debug(
        `Processing EaC commit ${handlerRequest.CommitID} Licenses processes for License ${handlerRequest.Lookup}`
      );

      const eac: EverythingAsCodeLicensing = handlerRequest.EaC;

      const currentLicenses = eac.Licenses || {};

      const licLookup = handlerRequest.Lookup;

      const current = currentLicenses[licLookup] || {};

      const license = handlerRequest.Model as EaCLicenseAsCode;

      const licDetails = (license.Details ||
        current.Details!) as EaCLicenseStripeDetails;

      if (licDetails) {
        const stripe = (Stripe as any)(licDetails.SecretKey)! as Stripe;

        const products = await stripe.products.list();

        const planLookups = Object.keys(license.Plans || {});

        const productCalls = planLookups.map(async (planLookup) => {
          const productId = `${licLookup}-${planLookup}`;

          const eacPlan = license.Plans![planLookup];

          if (!products.data.some((p) => p.id === productId)) {
            await stripe.products.create({
              id: productId,
              name: eacPlan.Details?.Name
                ? `${license.Details!.Name} - ${
                    eacPlan.Details?.Name || productId
                  }`
                : 'undefined',
              description: eacPlan.Details?.Description || undefined,
              active: true,
              type: 'service',
            });
          } else {
            await stripe.products.update(productId, {
              name: eacPlan.Details?.Name
                ? `${license.Details!.Name} - ${
                    eacPlan.Details?.Name || productId
                  }`
                : undefined,
              description: eacPlan.Details?.Description || undefined,
              active: true,
            });
          }

          const prices = await stripe.prices.list({
            product: productId,
          });

          const priceLookups = Object.keys(eacPlan.Prices || {});

          const priceCalls = priceLookups.map(async (priceLookup) => {
            const priceId = `${licLookup}-${planLookup}-${priceLookup}`;

            const eacPrice = eacPlan.Prices![priceLookup];

            const interval = eacPrice.Details!
              .Interval as Stripe.PriceCreateParams.Recurring.Interval;

            const unitAmount = Math.round(eacPrice.Details!.Value * 100);

            const price = prices.data.find((p) => p.unit_amount === unitAmount);

            if (!price) {
              await stripe.prices.create({
                lookup_key: unitAmount.toString(),
                unit_amount: unitAmount,
                currency: eacPrice.Details!.Currency,
                recurring: {
                  interval: interval,
                },
                metadata: {
                  priceId,
                },
                product: productId,
                nickname: eacPrice.Details?.Name,
                active: true,
              });
            }
          });

          // const allPriceLookups = new Set([
          //   ...priceLookups,
          //   ...Object.keys(current.Plans?.[planLookup]?.Prices || {}),
          // ]);

          const priceMap = priceLookups.reduce((acc, apl) => {
            const amount =
              eacPlan.Prices?.[apl]?.Details?.Value ||
              current.Plans?.[planLookup]?.Prices?.[apl]?.Details?.Value ||
              undefined;

            if (amount) {
              acc[(amount * 100).toString()] = apl;
            }

            return acc;
          }, {} as Record<string, string>);

          priceCalls.push(
            ...prices.data.map(async (price) => {
              const priceLookup = priceMap[price.lookup_key!];

              await stripe.prices.update(price.id, {
                active: !!priceLookup,
              });
            })
          );

          await Promise.all(priceCalls);
        });

        await Promise.all(productCalls);

        const secretClient = await loadMainSecretClient();

        const secretRoot = `licenses-${licLookup}`;

        if (
          // isEaCLicenseStripeDetails(licDetails) &&
          !licDetails.PublishableKey.startsWith('$secret:') ||
          !licDetails.SecretKey.startsWith('$secret:') ||
          !licDetails.WebhookSecret.startsWith('$secret:')
        ) {
          const secreted = await eacSetSecrets(secretClient, secretRoot, {
            PublishableKey: licDetails.PublishableKey,
            SecretKey: licDetails.SecretKey,
            WebhookSecret: licDetails.WebhookSecret,
          });

          license.Details = {
            ...license.Details,
            ...secreted,
          } as EaCLicenseStripeDetails;
        }
      }

      return Response.json({
        Checks: [],
        Lookup: licLookup,
        Messages: {
          Message: `The iot '${licLookup}' has been handled.`,
        },
        Model: license,
      } as EaCHandlerResponse);
    } catch (err) {
      logger.Package.error('There was an error configuring the licenses', err);

      return Response.json({
        HasError: true,
        Messages: {
          Error: JSON.stringify(err),
        },
      } as EaCHandlerErrorResponse);
    }
  },
} as EaCRuntimeHandlers;
