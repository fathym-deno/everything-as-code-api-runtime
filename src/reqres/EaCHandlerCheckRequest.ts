import { EaCMetadataBase, EverythingAsCode } from '@fathym/eac';

export type EaCHandlerCheckRequest =
  & {
    CommitID: string;

    CorelationID: string;

    EaC?: EverythingAsCode;

    ParentEaC?: EverythingAsCode;

    Type?: string;
  }
  & EaCMetadataBase;
