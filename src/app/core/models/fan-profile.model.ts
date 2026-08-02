export interface FanProfile {
  objectId: string;
  peladaPresentialRate?: number;
  peladaRemoteRate?: number;
  matchPresentialRate?: number;
  matchRemoteRate?: number;
  acceptsPaidCommitments?: boolean;
}

export interface CreateFanProfilePayload {
  peladaPresentialRate?: number;
  peladaRemoteRate?: number;
  matchPresentialRate?: number;
  matchRemoteRate?: number;
  acceptsPaidCommitments: boolean;
}

export type UpdateFanProfilePayload = Partial<CreateFanProfilePayload>;
