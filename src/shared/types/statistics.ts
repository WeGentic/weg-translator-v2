export type ProjectFileTotals = {
  total: number;
  processable: number;
  reference: number;
  instructions: number;
  ocr: number;
  image: number;
  other: number;
};

export type ProjectConversionStats = {
  total: number;
  completed: number;
  failed: number;
  pending: number;
  running: number;
  other: number;
  segments: number;
  tokens: number;
};

export type ProjectJobStats = {
  total: number;
  completed: number;
  failed: number;
  pending: number;
  running: number;
  other: number;
};

export type ProjectProgressStats = {
  processableFiles: number;
  filesReady: number;
  filesWithErrors: number;
  percentComplete: number;
};

export type ProjectWarningStats = {
  total: number;
  failedArtifacts: number;
  failedJobs: number;
};

export type ProjectStatistics = {
  totals: ProjectFileTotals;
  conversions: ProjectConversionStats;
  jobs: ProjectJobStats;
  progress: ProjectProgressStats;
  warnings: ProjectWarningStats;
  lastActivity?: string | null;
};
