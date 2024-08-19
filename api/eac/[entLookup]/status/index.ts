import { EaCStatus, EaCStatusProcessingTypes } from '@fathym/eac-api';
import { EaCRuntimeContext, EaCRuntimeHandlers } from '@fathym/eac-runtime';
import { EaCAPIUserState } from '../../../../src/state/EaCAPIUserState.ts';

export default {
  async POST(req, ctx: EaCRuntimeContext<EaCAPIUserState>) {
    const entLookup = ctx.State.UserEaC!.EnterpriseLookup;

    const eacKv = await ctx.Runtime.IoC.Resolve<Deno.Kv>(Deno.Kv, 'eac');

    const statiResults = await eacKv.list<EaCStatus>({
      prefix: ['EaC', 'Status', entLookup, 'ID'],
    });

    const stati: EaCStatus[] = [];

    const url = new URL(req.url);

    const statusTypes = url.searchParams
      .getAll('statusType')
      ?.map((st) => Number.parseInt(st) as EaCStatusProcessingTypes);

    for await (const status of statiResults) {
      if (
        !statusTypes ||
        statusTypes.length === 0 ||
        statusTypes.some((st) => st === status.value!.Processing)
      ) {
        stati.push(status.value!);
      }
    }

    const take = Number.parseInt(
      url.searchParams.get('take') || stati.length.toString()
    );

    const orderedStati = stati
      .sort(
        (a, b) =>
          new Date(b.StartTime).getTime() - new Date(a.StartTime).getTime()
      )
      .slice(0, take);

    return Response.json(orderedStati);
  },
} as EaCRuntimeHandlers;
