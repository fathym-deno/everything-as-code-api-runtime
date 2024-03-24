export type EaCHandlerErrorResponse = {
  HasError: true;

  Messages: Record<string, unknown>;
};

export function isEaCHandlerErrorResponse(
  res: unknown,
): res is EaCHandlerErrorResponse {
  const errorResponse = res as EaCHandlerErrorResponse;

  return (
    errorResponse.HasError !== undefined &&
    errorResponse.HasError &&
    typeof errorResponse.HasError === 'boolean' &&
    errorResponse.Messages !== undefined
  );
}
