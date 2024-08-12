import { STATUS_CODE } from '@std/http/status';

import { EverythingAsCode } from '@fathym/eac';
import { enqueueAtomic } from '@fathym/eac/deno';
import {
  EaCCommitRequest,
  EaCCommitResponse,
  EaCStatus,
  EaCStatusProcessingTypes,
} from '@fathym/eac-api';
import { EaCRuntimeContext, EaCRuntimeHandlers } from '@fathym/eac/runtime';
import { EaCAPIUserState } from '../../../src/state/EaCAPIUserState.ts';
import { EaCDeleteRequest } from '../../../src/reqres/EaCDeleteRequest.ts';
import { eacExists } from '../../../src/utils/eac/helpers.ts';

export default {
  async GET(req, ctx: EaCRuntimeContext<EaCAPIUserState>) {
    const entLookup = ctx.State.UserEaC!.EnterpriseLookup;

    const eacKv = await ctx.Runtime.IoC.Resolve<Deno.Kv>(Deno.Kv, 'eac');

    const eac = await eacKv.get<EverythingAsCode>([
      'EaC',
      'Current',
      entLookup,
    ]);

    return Response.json(eac.value);
  },

  async POST(req, ctx: EaCRuntimeContext<EaCAPIUserState>) {
    const entLookup = ctx.State.UserEaC!.EnterpriseLookup;

    const username = ctx.State.Username;

    const url = new URL(req.url);

    const processingSeconds = Number.parseInt(
      url.searchParams.get('processingSeconds')!
    );

    const eac = (await req.json()) as EverythingAsCode;

    const commitStatus: EaCStatus = {
      ID: crypto.randomUUID(),
      EnterpriseLookup: entLookup,
      Messages: { Queued: 'Commiting existing EaC container' },
      Processing: EaCStatusProcessingTypes.QUEUED,
      StartTime: new Date(Date.now()),
      Username: username!,
    };

    console.log(
      `Updating EaC container for ${eac.EnterpriseLookup} with Commit ID ${commitStatus.ID}.`
    );

    const commitReq: EaCCommitRequest = {
      CommitID: commitStatus.ID,
      EaC: {
        ...(eac || {}),
        EnterpriseLookup: commitStatus.EnterpriseLookup,
      },
      JWT: ctx.State.JWT!,
      ProcessingSeconds: processingSeconds,
      Username: '',
    };

    if (!commitReq.EaC.EnterpriseLookup) {
      return Response.json(
        {
          Message: 'The enterprise lookup must be provided.',
        },
        {
          status: STATUS_CODE.BadRequest,
        }
      );
    }

    const eacKv = await ctx.Runtime.IoC.Resolve<Deno.Kv>(Deno.Kv, 'eac');

    if (!(await eacExists(eacKv, commitReq.EaC.EnterpriseLookup))) {
      return Response.json(
        {
          Message:
            'The enterprise must first be created before it can be updated.',
        },
        {
          status: STATUS_CODE.BadRequest,
        }
      );
    }

    const commitKv = await ctx.Runtime.IoC.Resolve<Deno.Kv>(Deno.Kv, 'commit');

    await enqueueAtomic(
      commitKv,
      commitReq,
      (op) => {
        return op
          .set(
            [
              'EaC',
              'Status',
              commitStatus.EnterpriseLookup,
              'ID',
              commitStatus.ID,
            ],
            commitStatus
          )
          .set(
            ['EaC', 'Status', commitStatus.EnterpriseLookup, 'EaC'],
            commitStatus
          );
      },
      eacKv
    );

    console.log(
      `EaC container update for ${eac.EnterpriseLookup} queued with Commit ID ${commitStatus.ID}.`
    );

    return Response.json({
      CommitID: commitStatus.ID,
      EnterpriseLookup: commitStatus.EnterpriseLookup,
      Message: `The enterprise '${commitReq.EaC.EnterpriseLookup}' commit has been queued.`,
    } as EaCCommitResponse);
  },

  async DELETE(req, ctx: EaCRuntimeContext<EaCAPIUserState>) {
    const entLookup = ctx.State.UserEaC!.EnterpriseLookup;

    const username = ctx.State.Username!;

    const eac = (await req.json()) as EverythingAsCode;

    const url = new URL(req.url);

    const processingSeconds = Number.parseInt(
      url.searchParams.get('processingSeconds')!
    );

    const commitStatus: EaCStatus = {
      ID: crypto.randomUUID(),
      EnterpriseLookup: entLookup!,
      Messages: { Queued: 'Deleting existing EaC container' },
      Processing: EaCStatusProcessingTypes.QUEUED,
      StartTime: new Date(Date.now()),
      Username: username!,
    };

    const deleteReq: EaCDeleteRequest = {
      Archive: JSON.parse(
        url.searchParams.get('archive') || 'false'
      ) as boolean,
      CommitID: commitStatus.ID,
      EaC: {
        ...eac,
        EnterpriseLookup: entLookup,
      },
      JWT: ctx.State.JWT!,
      ProcessingSeconds: processingSeconds,
      Username: username,
    };

    if (!deleteReq.EaC.EnterpriseLookup) {
      return Response.json(
        {
          Message: 'The enterprise lookup must be provided.',
        },
        {
          status: STATUS_CODE.BadRequest,
        }
      );
    }

    const eacKv = await ctx.Runtime.IoC.Resolve<Deno.Kv>(Deno.Kv, 'eac');

    if (!(await eacExists(eacKv, deleteReq.EaC.EnterpriseLookup))) {
      return Response.json(
        {
          Message: `The enterprise must first be created before it can ${
            deleteReq.Archive ? ' be archived' : 'execute delete operations'
          }.`,
        },
        {
          status: STATUS_CODE.BadRequest,
        }
      );
    }

    const commitKv = await ctx.Runtime.IoC.Resolve<Deno.Kv>(Deno.Kv, 'commit');

    await enqueueAtomic(
      commitKv,
      deleteReq,
      (op) => {
        return op
          .set(
            [
              'EaC',
              'Status',
              commitStatus.EnterpriseLookup,
              'ID',
              commitStatus.ID,
            ],
            commitStatus
          )
          .set(
            ['EaC', 'Status', commitStatus.EnterpriseLookup, 'EaC'],
            commitStatus
          );
      },
      eacKv
    );

    return Response.json({
      CommitID: commitStatus.ID,
      EnterpriseLookup: commitStatus.EnterpriseLookup,
      Message: `The enterprise '${deleteReq.EaC.EnterpriseLookup}' ${
        deleteReq.Archive ? 'archiving' : 'delete operations'
      } have been queued.`,
    } as EaCCommitResponse);
  },
} as EaCRuntimeHandlers;
