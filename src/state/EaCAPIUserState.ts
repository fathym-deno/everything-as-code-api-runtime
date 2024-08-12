import { UserEaCRecord } from '@fathym/eac-api';
import { EaCAPIState } from './EaCAPIState.ts';

export type EaCAPIUserState = EaCAPIState & {
  UserEaC?: UserEaCRecord;
};
