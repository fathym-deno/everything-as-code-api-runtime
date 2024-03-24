import { EaCMetadataBase } from '@fathym/eac';
import { EaCHandlerCheckRequest } from './EaCHandlerCheckRequest.ts';

export type EaCHandlerResponse = {
  Checks: EaCHandlerCheckRequest[];

  Lookup: string;

  Messages: Record<string, unknown>;

  Model: EaCMetadataBase;
};

export function isEaCHandlerResponse(res: unknown): res is EaCHandlerResponse {
  const handlerResponse = res as EaCHandlerResponse;

  return (
    handlerResponse.Checks !== undefined &&
    Array.isArray(handlerResponse.Checks) &&
    handlerResponse.Lookup !== undefined &&
    typeof handlerResponse.Lookup === 'string' &&
    handlerResponse.Messages !== undefined &&
    handlerResponse.Model !== undefined
  );
}
