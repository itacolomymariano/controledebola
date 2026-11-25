export type PhotoPostSubjectKind =
  | 'event'
  | 'athlete_user'
  | 'amateur_team'
  | 'legend_athlete'
  | 'legend_team';

export interface PhotoPostItem {
  objectId: string;
  subjectKind: PhotoPostSubjectKind;
  subjectId: string;
  eventId?: string;
  imageUrl: string;
  caption: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl?: string;
  createdAt?: string;
}

export interface PhotoPostListResult {
  posts: PhotoPostItem[];
  canPost: boolean;
  cloudAvailable: boolean;
}