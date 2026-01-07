
export enum Team {
  User = 'Player',
  Computer = 'Computer'
}

export enum BallOutcomeType {
  Normal = 'Normal',
  Wide = 'Wide',
  NoBall = 'No-ball'
}

export interface BallRecord {
  over: number;
  ballNumber: number;
  runs: number;
  isWicket: boolean;
  outcomeType: BallOutcomeType;
  commentary: string;
  shot?: number;
}

export interface Innings {
  battingTeam: Team;
  bowlingTeam: Team;
  totalRuns: number;
  wickets: number;
  ballsBowled: number;
  maxOvers: number;
  maxWickets: number;
  history: BallRecord[];
  isComplete: boolean;
  onStrikePlayerIndex: number; // 0 or 1
}

export enum GameStage {
  Toss = 'Toss',
  Innings1 = 'Innings1',
  InningsBreak = 'InningsBreak',
  Innings2 = 'Innings2',
  Result = 'Result'
}

export interface GameState {
  stage: GameStage;
  innings1: Innings | null;
  innings2: Innings | null;
  tossWinner: Team | null;
  userDecision: 'Bat' | 'Bowl' | null;
}
