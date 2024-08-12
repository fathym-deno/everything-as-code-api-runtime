
import { UserEaCRecord } from '@fathym/eac-api';
import { EaCRuntimeContext, EaCRuntimeHandlers } from '@fathym/eac/runtime';
import { EaCAPIState } from '../../src/state/EaCAPIState.ts';

export default {
  async GET(req, ctx: EaCRuntimeContext<EaCAPIState>) {
    const username = ctx.State.Username!;

    const url = new URL(req.url);

    const parentEntLookup = url.searchParams.get('parentEntLookup');

    const eacKv = await ctx.Runtime.IoC.Resolve<Deno.Kv>(Deno.Kv, 'eac');

    const userEaCResults = await eacKv.list<UserEaCRecord>({
      prefix: ['User', username, 'EaC'],
    });

    const userEaCRecords: UserEaCRecord[] = [];

    try {
      for await (const userEaCRecord of userEaCResults) {
        if (
          !parentEntLookup ||
          userEaCRecord.value.ParentEnterpriseLookup === parentEntLookup
        ) {
          userEaCRecords.push(userEaCRecord.value);
        }
      }
    } catch (err) {
      console.log(err);
    }

    // const userEaCs = await denoKv.getMany<EverythingAsCode[]>(
    //   userEaCRecords.map((userEaC) => ["EaC", userEaC.EnterpriseLookup]),
    // );

    // const eacs = userEaCs.map((eac) => eac.value!);

    return Response.json(userEaCRecords);
  },
} as EaCRuntimeHandlers;
