import { merge } from '@fathym/common';
import { EverythingAsCode } from '@fathym/eac';
import { enqueueAtomicOperation, listenQueueAtomic } from '@fathym/eac/deno';
import {
  EaCCommitRequest,
  EaCStatus,
  EaCStatusProcessingTypes,
} from '@fathym/eac/api';
import { EaCCommitCheckRequest } from '../../src/reqres/EaCCommitCheckRequest.ts';
import { EaCHandlerCheckRequest } from '../../src/reqres/EaCHandlerCheckRequest.ts';
import { EaCHandlerErrorResponse } from '../../src/reqres/EaCHandlerErrorResponse.ts';
import {
  callEaCHandlerCheck,
  markEaCProcessed,
} from '../../src/utils/eac/helpers.ts';

export async function handleEaCCommitCheckRequest(
  eacKv: Deno.Kv,
  commitKv: Deno.Kv,
  commitCheckReq: EaCCommitCheckRequest
) {
  console.log(`Processing EaC commit check for ${commitCheckReq.CommitID}`);

  const { EnterpriseLookup, ParentEnterpriseLookup, Details, Handlers } =
    commitCheckReq.EaC;

  const statusKey = [
    'EaC',
    'Status',
    EnterpriseLookup!,
    'ID',
    commitCheckReq.CommitID,
  ];

  const status = await eacKv.get<EaCStatus>(statusKey);

  const errors: EaCHandlerErrorResponse[] = [];

  const allChecks: EaCHandlerCheckRequest[] = [];

  delete status.value!.Messages.Queued;

  let checkResponses = await Promise.all(
    commitCheckReq.Checks.map(async (check) => {
      const checkResp = await callEaCHandlerCheck(
        async (entLookup) => {
          const eac = await eacKv.get<EverythingAsCode>([
            'EaC',
            'Current',
            entLookup,
          ]);

          return eac.value!;
        },
        Handlers!,
        commitCheckReq.JWT,
        check
      );

      status.value!.Messages = merge(
        status.value!.Messages,
        checkResp.Messages
      );

      await eacKv.set(statusKey, status.value!);

      if (checkResp.HasError) {
        errors.push({
          HasError: true,
          Messages: checkResp.Messages,
        });
      }

      if (!checkResp.Complete) {
        allChecks.push(check);
      }

      return checkResp;
    })
  );

  if (errors.length > 0) {
    status.value!.Processing = EaCStatusProcessingTypes.ERROR;

    for (const error of errors) {
      status.value!.Messages = merge(status.value!.Messages, error.Messages);
    }

    status.value!.EndTime = new Date();
  } else if (allChecks.length > 0) {
    status.value!.Processing = EaCStatusProcessingTypes.PROCESSING;
  } else {
    status.value!.Processing = EaCStatusProcessingTypes.COMPLETE;

    status.value!.EndTime = new Date();
  }

  await listenQueueAtomic(
    commitKv,
    commitCheckReq,
    (op) => {
      op = op
        .set(
          [
            'EaC',
            'Status',
            commitCheckReq.EaC.EnterpriseLookup!,
            'ID',
            commitCheckReq.CommitID,
          ],
          status.value
        )
        .set(
          ['EaC', 'Status', commitCheckReq.EaC.EnterpriseLookup!, 'EaC'],
          status.value
        );

      if (allChecks.length > 0) {
        const newCommitCheckReq: EaCCommitCheckRequest = {
          ...commitCheckReq,
          Checks: allChecks,
          nonce: undefined,
          versionstamp: undefined,
        };

        op = enqueueAtomicOperation(op, newCommitCheckReq, 1000 * 10);

        console.log(`Requeuing EaC commit ${commitCheckReq.CommitID} checks`);
      } else if (errors.length > 0) {
        op = markEaCProcessed(EnterpriseLookup!, op);

        console.log(
          `Processed EaC commit ${commitCheckReq.CommitID}, from checks, with errors`
        );
        console.log(errors);
      } else {
        let saveEaC = { ...commitCheckReq.EaC };

        const toProcessEaC: EverythingAsCode = {
          EnterpriseLookup,
        };

        if (commitCheckReq.ToProcessKeys.length > 0) {
          commitCheckReq.ToProcessKeys.forEach((tpk) => {
            toProcessEaC[tpk] = saveEaC[tpk];

            delete saveEaC[tpk];
          });

          saveEaC = merge(commitCheckReq.OriginalEaC, saveEaC);

          const commitReq: EaCCommitRequest = {
            CommitID: commitCheckReq.CommitID,
            EaC: toProcessEaC,
            JWT: commitCheckReq.JWT,
            ProcessingSeconds: commitCheckReq.ProcessingSeconds,
            Username: commitCheckReq.Username,
          };

          op = enqueueAtomicOperation(op, commitReq);

          console.log(
            `Completed processing checks for commit ${
              commitCheckReq.CommitID
            }, requeued with keys ${commitCheckReq.ToProcessKeys.join(',')} `
          );
        } else {
          op = markEaCProcessed(EnterpriseLookup!, op);

          console.log(`Processed EaC commit ${commitCheckReq.CommitID}`);
        }

        op = op.set(['EaC', 'Current', EnterpriseLookup!], saveEaC);
      }

      return op;
    },
    eacKv
  );
}
