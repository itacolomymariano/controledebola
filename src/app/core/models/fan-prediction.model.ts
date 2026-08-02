export interface GoalScorerPrediction {
  userId: string;
  goals: number;
}

export interface FanPrediction {
  objectId: string;
  eventId: string;
  topScorerUserId?: string;
  leastConcededKeeperUserId?: string;
  homeScore?: number;
  awayScore?: number;
  homeTeamName?: string;
  awayTeamName?: string;
  goalScorers?: GoalScorerPrediction[];
  expelledUserIds?: string[];
  yellowCardUserIds?: string[];
}

export interface CreateFanPredictionPayload {
  eventId: string;
  topScorerUserId?: string;
  leastConcededKeeperUserId?: string;
  homeScore?: number;
  awayScore?: number;
  homeTeamName?: string;
  awayTeamName?: string;
  goalScorers?: GoalScorerPrediction[];
  expelledUserIds?: string[];
  yellowCardUserIds?: string[];
}

export interface EventAthleteOption {
  userId: string;
  userName: string;
  apelido: string;
  avatarUrl?: string;
  primaryPosition?: string;
  secondaryPosition?: string;
  thirdPosition?: string;
}

export interface PredictionRankingEntry {
  userId: string;
  userName: string;
  avatarUrl?: string;
  totalScore: number;
  eventsCount: number;
}
