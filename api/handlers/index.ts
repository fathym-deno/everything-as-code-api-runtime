import { isEaCCommitRequest } from '@fathym/eac/api';
import { EaCRuntime, IS_BUILDING } from '@fathym/eac/runtime';
import { isEaCCommitCheckRequest } from '../../src/reqres/EaCCommitCheckRequest.ts';
import { isEaCDeleteRequest } from '../../src/reqres/EaCDeleteRequest.ts';
import { handleEaCCommitCheckRequest } from './commit-check.handler.ts';
import { handleEaCDeleteRequest } from './delete.handler.ts';
import { handleEaCCommitRequest } from './commit.handler.ts';

export const listenForCommits = async (rt: EaCRuntime) => {
  if (!IS_BUILDING) {
    const commitKv = await rt.IoC.Resolve<Deno.Kv>(Deno.Kv, 'commit');

    const eacKv = await rt.IoC.Resolve<Deno.Kv>(Deno.Kv, 'eac');

    /**
     * This listener set is responsible for the core EaC actions.
     */
    commitKv.listenQueue(async (msg: unknown) => {
      const trackingKey = ['Handlers', 'Commits', 'Processing'];

      if (isEaCCommitCheckRequest(msg)) {
        console.log(
          `Queue message picked up for processing commit checks ${msg.CommitID}`
        );

        trackingKey.push('Checks');
        trackingKey.push(msg.CommitID);
      } else if (isEaCDeleteRequest(msg)) {
        console.log(
          `Queue message picked up for processing commit delete ${msg.CommitID}`
        );

        trackingKey.push('Delete');
        trackingKey.push(msg.CommitID);
      } else if (isEaCCommitRequest(msg)) {
        console.log(
          `Queue message picked up for processing commit ${msg.CommitID}`
        );

        trackingKey.push('Commit');
        trackingKey.push(msg.CommitID);
      }

      try {
        const isCommitting = await commitKv.get<boolean>(trackingKey);

        if (!isCommitting.value) {
          await commitKv.set(trackingKey, true);

          if (isEaCCommitCheckRequest(msg)) {
            await handleEaCCommitCheckRequest(eacKv, msg);
          } else if (isEaCDeleteRequest(msg)) {
            await handleEaCDeleteRequest(eacKv, msg);
          } else if (isEaCCommitRequest(msg)) {
            await handleEaCCommitRequest(eacKv, msg);
          }
        } else {
          console.log(
            `The commit ${
              (msg as { CommitID: string }).CommitID
            } is already processing.`
          );
        }
      } finally {
        await commitKv.delete(trackingKey);

        console.log(
          `The commit ${
            (msg as { CommitID: string }).CommitID
          } completed processing.`
        );
      }
    });
  }
};
