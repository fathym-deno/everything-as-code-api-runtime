import { Deployment } from 'npm:@azure/arm-resources';

export type EaCCloudDeployment = {
  CloudLookup: string;

  Deployment: Deployment;

  Name: string;

  ResourceGroupLookup: string;
};
