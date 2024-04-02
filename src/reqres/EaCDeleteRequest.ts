import { EverythingAsCode } from '@fathym/eac';
import { DenoKVNonce } from '@fathym/eac/deno';

export type EaCDeleteRequest = {
  Archive: boolean;

  CommitID: string;

  EaC: EverythingAsCode;

  JWT: string;

  ProcessingSeconds: number;

  Username: string;
} & DenoKVNonce;

export function isEaCDeleteRequest(req: unknown): req is EaCDeleteRequest {
  const deleteRequest = req as EaCDeleteRequest;

  return (
    deleteRequest.EaC !== undefined &&
    deleteRequest.EaC.EnterpriseLookup !== undefined &&
    typeof deleteRequest.EaC.EnterpriseLookup === 'string' &&
    typeof deleteRequest.Archive === 'boolean' &&
    deleteRequest.CommitID !== undefined &&
    typeof deleteRequest.CommitID === 'string'
  );
}
