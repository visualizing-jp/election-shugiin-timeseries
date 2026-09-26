/** 地域（都道府県・ブロック・全国）ごとの党派別得票。合計は有効投票数。 */
export interface AreaVotes {
  votes: Record<string, number>;
  total: number;
}

export interface SystemVotes {
  national: AreaVotes;
  /** 都道府県（小選挙区）またはブロック（比例代表）。第41〜43回はない。 */
  areas?: Record<string, AreaVotes>;
  /** 全国表（届出政党等別・党派別得票数）の「今回」欄。突合用。 */
  reported?: AreaVotes;
}

export interface NormalizedElection {
  n: number;
  smd: SystemVotes;
  pr: SystemVotes;
}
