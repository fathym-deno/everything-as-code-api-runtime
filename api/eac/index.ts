import { STATUS_CODE } from '@std/http/status';

import { EverythingAsCode } from '@fathym/eac';
import { enqueueAtomic } from '@fathym/common/deno-kv';
import {
  EaCCommitRequest,
  EaCCommitResponse,
  EaCStatus,
  EaCStatusProcessingTypes,
} from '@fathym/eac-api';
import { EaCRuntimeContext, EaCRuntimeHandlers } from '@fathym/eac-runtime';
import { eacExists } from '../../src/utils/eac/helpers.ts';
import { EaCAPIState } from '../../src/state/EaCAPIState.ts';
import { EaCAPILoggingProvider } from '../../src/plugins/EaCAPILoggingProvider.ts';

export default {
  async POST(req, ctx: EaCRuntimeContext<EaCAPIState>) {
    const logger = await ctx.Runtime.IoC.Resolve(EaCAPILoggingProvider);

    const url = new URL(req.url);

    const username = url.searchParams.get('username')!;

    const processingSeconds = Number.parseInt(
      url.searchParams.get('processingSeconds')!
    );

    const eac: EverythingAsCode = await req.json();

    const createStatus: EaCStatus = {
      ID: crypto.randomUUID(),
      EnterpriseLookup: eac.EnterpriseLookup || crypto.randomUUID(),
      Messages: { Queued: 'Creating new EaC container' },
      Processing: EaCStatusProcessingTypes.QUEUED,
      StartTime: new Date(Date.now()),
      Username: username,
    };

    logger.Package.debug(
      `Create EaC container for ${eac.EnterpriseLookup} with Commit ID ${createStatus.ID} for user ${createStatus.Username}.`
    );

    const eacKv = await ctx.Runtime.IoC.Resolve<Deno.Kv>(Deno.Kv, 'eac');

    while (await eacExists(eacKv, createStatus.EnterpriseLookup)) {
      createStatus.EnterpriseLookup = crypto.randomUUID();
    }

    const commitReq: EaCCommitRequest = {
      CommitID: createStatus.ID,
      EaC: {
        ...(eac || {}),
        EnterpriseLookup: createStatus.EnterpriseLookup,
        ParentEnterpriseLookup: ctx.State.EnterpriseLookup,
      },
      JWT: ctx.State.JWT!,
      ProcessingSeconds: processingSeconds,
      Username: username,
    };

    if (!commitReq.EaC.EnterpriseLookup) {
      return Response.json(
        {
          Message: 'There was an issue creating a new EaC container.',
        },
        {
          status: STATUS_CODE.BadRequest,
        }
      );
    }

    if (!commitReq.EaC.Details?.Name) {
      return Response.json(
        {
          Message:
            'The name must be provided when creating a new EaC container.',
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
              createStatus.EnterpriseLookup,
              'ID',
              createStatus.ID,
            ],
            createStatus
          )
          .set(
            ['EaC', 'Status', createStatus.EnterpriseLookup, 'EaC'],
            createStatus
          );
      },
      eacKv
    );

    logger.Package.debug(
      `EaC container creation for ${eac.EnterpriseLookup} queued with Commit ID ${createStatus.ID}.`
    );

    return Response.json({
      CommitID: createStatus.ID,
      EnterpriseLookup: createStatus.EnterpriseLookup,
      Message: `The enterprise '${createStatus.EnterpriseLookup}' commit has been queued.`,
    } as EaCCommitResponse);
  },
} as EaCRuntimeHandlers;
