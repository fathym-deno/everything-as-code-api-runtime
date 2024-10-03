import { isEaCCommitRequest } from '@fathym/eac-api';
import { EaCRuntime, IS_BUILDING } from '@fathym/eac-runtime';
import { isEaCCommitCheckRequest } from '../../src/reqres/EaCCommitCheckRequest.ts';
import { isEaCDeleteRequest } from '../../src/reqres/EaCDeleteRequest.ts';
import { handleEaCCommitCheckRequest } from './commit-check.handler.ts';
import { handleEaCDeleteRequest } from './delete.handler.ts';
import { handleEaCCommitRequest } from './commit.handler.ts';
import { LoggingProvider } from '@fathym/common/log';

export const listenForCommits = async (rt: EaCRuntime) => {
  if (!IS_BUILDING) {
    const commitKv = await rt.IoC.Resolve<Deno.Kv>(Deno.Kv, 'commit');

    const eacKv = await rt.IoC.Resolve<Deno.Kv>(Deno.Kv, 'eac');

    /**
     * This listener set is responsible for the core EaC actions.
     */
    commitKv.listenQueue(async (msg: unknown) => {
      const logger = await rt.IoC.Resolve(LoggingProvider);

      const trackingKey = ['Handlers', 'Commits', 'Processing'];

      if (isEaCCommitCheckRequest(msg)) {
        logger.Package.debug(
          `Queue message picked up for processing commit checks ${msg.CommitID}`
        );

        trackingKey.push('Checks');
        trackingKey.push(msg.CommitID);
      } else if (isEaCDeleteRequest(msg)) {
        logger.Package.debug(
          `Queue message picked up for processing commit delete ${msg.CommitID}`
        );

        trackingKey.push('Delete');
        trackingKey.push(msg.CommitID);
      } else if (isEaCCommitRequest(msg)) {
        logger.Package.debug(
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
            await handleEaCCommitCheckRequest(logger.Package, eacKv, commitKv, msg);
          } else if (isEaCDeleteRequest(msg)) {
            await handleEaCDeleteRequest(logger.Package, eacKv, commitKv, msg);
          } else if (isEaCCommitRequest(msg)) {
            await handleEaCCommitRequest(logger.Package, eacKv, commitKv, msg);
          }
        } else {
          logger.Package.debug(
            `The commit ${
              (msg as { CommitID: string }).CommitID
            } is already processing.`
          );
        }
      } finally {
        await commitKv.delete(trackingKey);

        logger.Package.debug(
          `The commit ${
            (msg as { CommitID: string }).CommitID
          } completed processing.`
        );
      }
    });
  }
};
