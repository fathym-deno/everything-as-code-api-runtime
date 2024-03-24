import { EaCCloudDeployment } from './EaCCloudDeployment.ts';
import { EaCHandlerCheckRequest } from './EaCHandlerCheckRequest.ts';

export type EaCHandlerCloudCheckRequest =
  & Omit<
    EaCCloudDeployment,
    'Deployment'
  >
  & EaCHandlerCheckRequest;
