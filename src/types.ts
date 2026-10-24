export type ToolStatus = 'healthy' | 'attention' | 'critical' | 'not_checked';

export type CheckStatus = 'passed' | 'failed' | 'not_checked' | 'in_progress';

export type CheckSeverity = 'none' | 'low' | 'medium' | 'high' | 'critical';

export type ProviderType = 'sample' | 'github' | 'gitlab' | 'bitbucket' | 'codeberg' | 'gitea' | 'sourcehut';

export interface CheckRun {
  id: string;
  toolId: string;
  checkType: 'availability' | 'readme' | 'actions' | 'release' | 'license' | 'activity' | string;
  status: CheckStatus;
  severity: CheckSeverity;
  summary: string;
  evidence: string;
  observedAt: string;
}

export interface Finding {
  id: string;
  toolId: string;
  toolName?: string;
  repository?: string;
  provider?: ProviderType;
  checkType: string;
  status: 'open' | 'resolved';
  severity: CheckSeverity;
  summary: string;
  evidence: string;
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
}

export interface Tool {
  id: string;
  name: string;
  repository: string;
  status: ToolStatus;
  healthScore: number;
  summary: string;
  owner: string;
  provider: ProviderType;
  updatedAt: string;
  lastCheckedAt: string | null;
  nextCheckAt: string | null;
  monitoringError: string | null;
  checkRuns: CheckRun[];
  stars?: number;
  openIssues?: number;
  description?: string;
  defaultBranch?: string;
  license?: string;
  language?: string;
}

export interface User {
  id: string;
  name: string;
  email: string | null;
  mobile: string | null;
  organization: string | null;
  jobTitle: string | null;
  role: 'admin' | 'developer';
  createdAt: string;
}

export interface GitHubRepositoryOption {
  fullName: string;
  name: string;
  owner: string;
  url: string;
  description: string | null;
  language: string | null;
  updatedAt: string | null;
  stars?: number;
}
