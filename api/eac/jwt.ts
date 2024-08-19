import { STATUS_CODE } from '@std/http/status';

import { loadJwtConfig } from '@fathym/common/jwt';
import { EverythingAsCode } from '@fathym/eac';
import { UserEaCRecord } from '@fathym/eac-api';
import { EaCRuntimeContext, EaCRuntimeHandlers } from '@fathym/eac-runtime';
import { EaCAPIState } from '../../src/state/EaCAPIState.ts';

export default {
  async GET(req, ctx: EaCRuntimeContext<EaCAPIState>) {
    const parentEntLookup = ctx.State.EnterpriseLookup;

    if (!parentEntLookup) {
      return Response.json(
        {
          Message: `The provided JWT is invalid.`,
        },
        {
          status: STATUS_CODE.Unauthorized,
        }
      );
    }

    const url = new URL(req.url);

    const entLookup = url.searchParams.get('entLookup')!;

    const username = url.searchParams.get('username')!;

    const expTime = Number.parseInt(
      url.searchParams.get('expTime') || `${60 * 60 * 1}`
    );

    const eacKv = await ctx.Runtime.IoC.Resolve<Deno.Kv>(Deno.Kv, 'eac');

    const eacRes = await eacKv.get<EverythingAsCode>([
      'EaC',
      'Current',
      entLookup,
    ]);

    const eac = eacRes.value;

    if (eac?.ParentEnterpriseLookup !== parentEntLookup) {
      return Response.json(
        {
          Message: `You are not authorized to generate a JWT for this enterprise.`,
        },
        {
          status: STATUS_CODE.Unauthorized,
        }
      );
    }

    const userEaC = await eacKv.get<UserEaCRecord>([
      'User',
      username,
      'EaC',
      entLookup,
    ]);

    if (!userEaC?.value) {
      return Response.json(
        {
          Message: `The requested user ${username} does not have access to the enterprise '${entLookup}'.`,
        },
        {
          status: STATUS_CODE.Unauthorized,
        }
      );
    }

    const jwt = await loadJwtConfig().Create(
      {
        EnterpriseLookup: entLookup,
        Username: username,
      },
      expTime
    );

    return Response.json({
      Token: jwt,
    });
  },
} as EaCRuntimeHandlers;
