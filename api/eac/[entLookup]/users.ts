import { STATUS_CODE } from '@std/http/status';

import { EverythingAsCode } from '@fathym/eac';
import { UserEaCRecord } from '@fathym/eac-api';
import { EaCRuntimeContext, EaCRuntimeHandlers } from '@fathym/eac-runtime';
import { EaCAPIUserState } from '../../../src/state/EaCAPIUserState.ts';

export default {
  async GET(req, ctx: EaCRuntimeContext<EaCAPIUserState>) {
    const entLookup = ctx.State.UserEaC!.EnterpriseLookup;

    const eacKv = await ctx.Runtime.IoC.Resolve<Deno.Kv>(Deno.Kv, 'eac');

    const eacUserResults = await eacKv.list<UserEaCRecord>({
      prefix: ['EaC', 'Users', entLookup],
    });

    const userEaCRecords: UserEaCRecord[] = [];

    for await (const userEaCRecord of eacUserResults) {
      userEaCRecords.push(userEaCRecord.value);
    }

    return Response.json(userEaCRecords);
  },

  async POST(req, ctx: EaCRuntimeContext<EaCAPIUserState>) {
    const entLookup = ctx.State.UserEaC!.EnterpriseLookup;

    const userEaCRecord = (await req.json()) as UserEaCRecord;

    userEaCRecord.EnterpriseLookup = entLookup;

    if (!userEaCRecord.EnterpriseLookup) {
      return Response.json(
        {
          Message: 'The enterprise lookup must be provided.',
        },
        {
          status: STATUS_CODE.BadRequest,
        }
      );
    }

    if (!userEaCRecord.Username) {
      return Response.json(
        {
          Message: 'The username must be provided.',
        },
        {
          status: STATUS_CODE.BadRequest,
        }
      );
    }

    const eacKv = await ctx.Runtime.IoC.Resolve<Deno.Kv>(Deno.Kv, 'eac');

    const existingEaC = await eacKv.get<EverythingAsCode>([
      'EaC',
      'Current',
      entLookup,
    ]);

    if (!existingEaC.value) {
      return Response.json(
        {
          Message:
            'The enterprise must first be created before a user can be invited.',
        },
        {
          status: STATUS_CODE.BadRequest,
        }
      );
    }

    userEaCRecord.EnterpriseName = existingEaC.value.Details!.Name!;

    userEaCRecord.ParentEnterpriseLookup =
      existingEaC.value.ParentEnterpriseLookup!;

    await eacKv
      .atomic()
      .set(['User', userEaCRecord.Username, 'EaC', entLookup], userEaCRecord)
      .set(['EaC', 'Users', entLookup, userEaCRecord.Username], userEaCRecord)
      .commit();

    //  TODO: Send user invite email

    return Response.json({
      Message: `The user '${userEaCRecord.Username}' has been invited to enterprise '${userEaCRecord.EnterpriseLookup}'.`,
    });
  },
} as EaCRuntimeHandlers;
