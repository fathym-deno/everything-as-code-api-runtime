export type EaCHandlerCheckResponse = {
  CorelationID: string;

  Complete: boolean;

  HasError: boolean;

  Messages: Record<string, unknown>;
};

export function isEaCHandlerCheckResponse(
  res: unknown,
): res is EaCHandlerCheckResponse {
  const checkResponse = res as EaCHandlerCheckResponse;

  return (
    checkResponse.Complete !== undefined &&
    typeof checkResponse.Complete === 'boolean' &&
    checkResponse.HasError !== undefined &&
    typeof checkResponse.HasError === 'boolean' &&
    checkResponse.Messages !== undefined
  );
}
