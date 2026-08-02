export type EventMediaCategory =
  | 'radio_narration'
  | 'radio_interview'
  | 'journal_reportage'
  | 'journal_interview'
  | 'highlight_video';

export type EventMediaReactionType = 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'angry';

export type EventMediaTopKind = 'video' | 'radio' | 'journal';

export interface EventMediaAuthor {
  authorId: string;
  authorName: string;
  authorApelido: string;
  authorAvatarUrl?: string;
  updatedAt?: string;
}

export interface EventMediaVoteSummary {
  voteCount: number;
  averageScore: number;
}

export interface EventMediaRadioItem extends EventMediaAuthor {
  title: string;
  description: string;
  audioUrl: string;
  viewCount: number;
  votes: EventMediaVoteSummary;
  myScore: number | null;
}

export interface EventMediaJournalItem extends EventMediaAuthor {
  headline: string;
  photoUrl: string;
  body: string;
  viewCount: number;
  votes: EventMediaVoteSummary;
  myScore: number | null;
}

export interface EventMediaHighlightVideoItem extends EventMediaAuthor {
  title: string;
  description: string;
  videoUrl: string;
  durationSec: number;
  viewCount: number;
}

export interface EventMediaDashboard {
  eventId: string;
  radioNarration: EventMediaRadioItem | null;
  radioInterview: EventMediaRadioItem | null;
  journalReportage: EventMediaJournalItem | null;
  journalInterview: EventMediaJournalItem | null;
  highlightVideo: EventMediaHighlightVideoItem | null;
  myVotes: Partial<Record<EventMediaCategory, number>>;
  cloudAvailable: boolean;
}

export interface EventMediaReactionSummary {
  total: number;
  counts: Record<EventMediaReactionType, number>;
  myReaction: EventMediaReactionType | null;
}

export interface EventMediaComment {
  objectId: string;
  userId: string;
  userName: string;
  text: string;
  parentCommentId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  reactions: EventMediaReactionSummary;
}

export interface EventMediaEngagement {
  viewCount: number;
  viewedByMe: boolean;
  reactions: EventMediaReactionSummary;
  comments: EventMediaComment[];
}

export interface EventMediaTopItem {
  kind: EventMediaTopKind;
  category: EventMediaCategory;
  eventId: string;
  eventName: string;
  peladaId: string;
  peladaName: string;
  publicationId: string;
  title: string;
  description: string;
  mediaUrl: string;
  viewCount: number;
  authorName: string;
  authorApelido: string;
  authorAvatarUrl?: string;
  updatedAt?: string;
}

export const EVENT_MEDIA_CATEGORY_LABELS: Record<EventMediaCategory, string> = {
  radio_narration: 'Narracao de gol',
  radio_interview: 'Entrevista (radio)',
  journal_reportage: 'Reportagem',
  journal_interview: 'Entrevista (jornal)',
  highlight_video: 'Video de melhores momentos',
};

export const EVENT_MEDIA_SCORE_OPTIONS = Array.from({ length: 11 }, (_, index) => index);

export const EVENT_MEDIA_REACTION_OPTIONS: Array<{
  value: EventMediaReactionType;
  label: string;
  emoji: string;
}> = [
  { value: 'like', label: 'Curtir', emoji: '👍' },
  { value: 'love', label: 'Amei', emoji: '❤️' },
  { value: 'haha', label: 'Haha', emoji: '😆' },
  { value: 'wow', label: 'Uau', emoji: '😮' },
  { value: 'sad', label: 'Triste', emoji: '😢' },
  { value: 'angry', label: 'Grr', emoji: '😡' },
];

export const HIGHLIGHT_VIDEO_MAX_SECONDS = 5 * 60;
export const HIGHLIGHT_VIDEO_MAX_BYTES = 80 * 1024 * 1024;

export function emptyEventMediaReactionSummary(): EventMediaReactionSummary {
  return {
    total: 0,
    counts: {
      like: 0,
      love: 0,
      haha: 0,
      wow: 0,
      sad: 0,
      angry: 0,
    },
    myReaction: null,
  };
}
