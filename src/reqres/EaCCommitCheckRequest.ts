import { EverythingAsCode } from '@fathym/eac';
import { EaCCommitRequest } from '@fathym/eac/api';
import { EaCHandlerCheckRequest } from './EaCHandlerCheckRequest.ts';

export type EaCCommitCheckRequest =
  & {
    Checks: EaCHandlerCheckRequest[];

    OriginalEaC: EverythingAsCode;

    ToProcessKeys: string[];
  }
  & EaCCommitRequest;

export function isEaCCommitCheckRequest(
  req: unknown,
): req is EaCCommitCheckRequest {
  const commitRequest = req as EaCCommitCheckRequest;

  return (
    commitRequest.Checks !== undefined &&
    Array.isArray(commitRequest.Checks) &&
    commitRequest.OriginalEaC !== undefined &&
    commitRequest.ToProcessKeys !== undefined &&
    Array.isArray(commitRequest.ToProcessKeys)
  );
}
