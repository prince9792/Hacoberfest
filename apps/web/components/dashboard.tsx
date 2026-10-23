"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  Blocks,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Clock3,
  GitBranch,
  Github,
  LayoutDashboard,
  ListFilter,
  LoaderCircle,
  LogOut,
  RefreshCw,
  RotateCw,
  Search,
  Settings2,
  Shield,
  Trash2,
} from "lucide-react";

type Tool = {
  id: string;
  name: string;
  repository: string;
  status: "healthy" | "attention" | "critical" | "not_checked";
  healthScore: number;
  summary: string;
  owner: string;
  updatedAt: string;
  provider: "sample" | "github";
  checkRuns: CheckRun[];
  lastCheckedAt: string | null;
  nextCheckAt: string | null;
  monitoringError: string | null;
};

type CheckRun = {
  id: string;
  checkType: string;
  status: "passed" | "failed" | "not_checked" | "in_progress";
  severity: string;
  summary: string;
  evidence: string;
  observedAt: string;
};

type Finding = {
  id: string;
  toolId: string;
  checkType: string;
  status: "open" | "resolved";
  severity: string;
  summary: string;
  evidence: string;
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
};

type GitHubRepository = {
  fullName: string;
  name: string;
  owner: string;
  url: string;
  description: string | null;
  language: string | null;
  updatedAt: string | null;
};

type GraphQLResponse = {
  data?: {
    tools?: Tool[];
    findings?: Finding[];
    monitorIntervalSeconds?: number;
    importPublicRepository?: Tool;
    recheckPublicRepository?: Tool;
    setFindingStatus?: Finding;
    removePublicRepository?: boolean;
  };
  errors?: Array<{ message: string }>;
};

type Section = "overview" | "repositories" | "findings" | "integrations" | "settings";
type StatusFilter = "all" | Tool["status"];
type ProviderFilter = "all" | Tool["provider"];

const query = `query WorkspaceOverview {
  tools {
    id
    name
    repository
    status
    healthScore
    summary
    owner
    provider
    updatedAt
    lastCheckedAt
    nextCheckAt
    monitoringError
    checkRuns {
      id
      checkType
      status
      severity
      summary
      evidence
      observedAt
    }
  }
  findings {
    id
    toolId
    checkType
    status
    severity
    summary
    evidence
    firstSeenAt
    lastSeenAt
    resolvedAt
  }
  monitorIntervalSeconds
}`;
const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/graphql")
  .replace(/\/graphql\/?$/, "");

const importPublicRepositoryMutation = `mutation ImportPublicRepository($fullName: String!) {
  importPublicRepository(fullName: $fullName) {
    id
    repository
    provider
  }
}`;

const recheckRepositoryMutation = `mutation RecheckPublicRepository($id: ID!) {
  recheckPublicRepository(id: $id) { id }
}`;

const setFindingStatusMutation = `mutation SetFindingStatus($id: ID!, $status: String!) {
  setFindingStatus(id: $id, status: $status) { id status }
}`;

const removeRepositoryMutation = `mutation RemovePublicRepository($id: ID!) {
  removePublicRepository(id: $id)
}`;

async function requestGraphQL(
  requestQuery: string,
  variables?: Record<string, string>
): Promise<NonNullable<GraphQLResponse["data"]>> {
  const response = await fetch(
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/graphql",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ query: requestQuery, ...(variables ? { variables } : {}) }),
      cache: "no-store"
    }
  );
  if (!response.ok) {
    throw new Error(`The workspace request failed with HTTP ${response.status}.`);
  }
  const result = (await response.json()) as GraphQLResponse;
  if (result.errors?.length) {
    throw new Error(result.errors.map((item) => item.message).join(" "));
  }
  if (!result.data) {
    throw new Error("The API response did not include workspace data.");
  }
  return result.data;
}

const sections: Array<{ id: Section; label: string; icon: typeof LayoutDashboard }> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "repositories", label: "Repositories", icon: GitBranch },
  { id: "findings", label: "Findings", icon: Shield },
  { id: "integrations", label: "Integrations", icon: Blocks },
  { id: "settings", label: "Settings", icon: Settings2 }
];

const providers = [
  { name: "GitHub", note: "GitHub.com public repositories", icon: Github },
  { name: "GitLab", note: "GitLab.com account OAuth", icon: GitBranch },
  { name: "Codeberg", note: "Forgejo-compatible API", icon: Blocks },
  { name: "Bitbucket", note: "Cloud and Data Center", icon: Blocks },
  { name: "Gitea / Forgejo", note: "Self-hosted instances", icon: GitBranch },
  { name: "Wikimedia", note: "Wikimedia project services", icon: Blocks }
];

const statusLabels: Record<Tool["status"], string> = {
  healthy: "Healthy",
  attention: "Needs attention",
  critical: "Critical",
  not_checked: "Not checked"
}

function CheckStatusBadge({ status }: { status: CheckRun["status"] }) {
  const styles: Record<CheckRun["status"], string> = {
    passed: "bg-emerald-300/10 text-emerald-200",
    failed: "bg-amber-300/10 text-amber-100",
    in_progress: "bg-sky-300/10 text-sky-100",
    not_checked: "bg-white/[0.06] text-white/45"
  };
  const labels: Record<CheckRun["status"], string> = {
    passed: "Passed",
    failed: "Signal",
    in_progress: "In progress",
    not_checked: "Not checked"
  };
  return <span className={`rounded-md px-2 py-1 text-[10px] ${styles[status]}`}>{labels[status]}</span>;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

function StatusBadge({ status }: { status: Tool["status"] }) {
  const styles: Record<Tool["status"], string> = {
    healthy: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
    attention: "border-amber-400/20 bg-amber-400/10 text-amber-200",
    critical: "border-rose-400/20 bg-rose-400/10 text-rose-300",
    not_checked: "border-white/10 bg-white/[0.04] text-white/50"
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${styles[status]}`}>
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {statusLabels[status]}
    </span>
  );
}

function Sidebar({
  section,
  onSectionChange
}: {
  section: Section;
  onSectionChange: (section: Section) => void;
}) {
  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-white/[0.08] bg-[#111211] p-4 lg:fixed lg:inset-y-0 lg:left-0 lg:w-[248px] lg:border-b-0 lg:border-r lg:border-white/[0.08] lg:p-5">
      <a className="flex items-center gap-3 px-2 py-2" href="/" aria-label="Tool Doctor dashboard">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-200">
          <Activity aria-hidden="true" size={19} />
        </span>
        <span className="text-[15px] font-semibold tracking-tight text-white">tool doctor</span>
      </a>

      <div className="mt-7 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3">
        <p className="px-1 text-[10px] font-medium uppercase tracking-[0.16em] text-white/35">
          Workspace
        </p>
        <div className="mt-2 flex w-full items-center justify-between rounded-lg px-1 py-1 text-left">
          <span>
            <span className="block text-sm font-medium text-white/90">Hacoberfest</span>
            <span className="mt-0.5 block text-xs text-white/40">Local workspace</span>
          </span>
        </div>
      </div>

      <nav aria-label="Workspace navigation" className="mt-7 flex gap-1 overflow-x-auto lg:flex-col">
        <p className="hidden px-3 pb-2 text-[10px] font-medium uppercase tracking-[0.16em] text-white/35 lg:block">
          Workspace
        </p>
        {sections.map(({ id, label, icon: Icon }) => (
          <button
            aria-current={section === id ? "page" : undefined}
            className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] transition-colors ${
              section === id
                ? "bg-white/[0.09] font-medium text-white"
                : "text-white/55 hover:bg-white/[0.05] hover:text-white/85"
            }`}
            key={id}
            onClick={() => onSectionChange(id)}
            type="button"
          >
            <Icon aria-hidden="true" size={16} strokeWidth={1.8} />
            {label}
          </button>
        ))}
      </nav>

      <div className="mt-auto hidden rounded-xl border border-white/[0.08] bg-white/[0.025] p-3 lg:block">
        <div className="flex items-center gap-2 text-xs font-medium text-white/75">
          <CircleHelp aria-hidden="true" size={15} />
          Building in public
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-white/40">
          Public GitHub checks are read-only. OAuth, private repositories, and non-GitHub providers are not connected.
        </p>
        <a
          className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-emerald-200/80 hover:text-emerald-100"
          href="https://github.com/prince9792/Hacoberfest"
          rel="noreferrer"
          target="_blank"
        >
          View project
          <ArrowUpRight aria-hidden="true" size={12} />
        </a>
      </div>
    </aside>
  );
}

function SampleNotice() {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-sky-300/10 bg-sky-300/[0.04] px-3.5 py-3 text-xs leading-relaxed text-sky-100/70">
      <CircleHelp aria-hidden="true" className="mt-0.5 shrink-0 text-sky-200/70" size={15} />
      <p>
        <span className="font-medium text-sky-100/90">Prototype workspace.</span> Seeded scores are
        examples, while GitHub imports use public metadata only and do not produce an overall health assessment.
      </p>
    </div>
  );
}

function GitHubRepositoryPicker({
  linked,
  importedRepositories,
  importing,
  feedback,
  error,
  onImport
}: {
  linked: boolean;
  importedRepositories: Set<string>;
  importing: boolean;
  feedback: string | null;
  error: string | null;
  onImport: (fullName: string) => void;
}) {
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [selectedRepository, setSelectedRepository] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const loadRepositories = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/auth/github/repositories`, {
        credentials: "include",
        cache: "no-store",
      });
      const result = (await response.json()) as {
        error?: string;
        repositories?: GitHubRepository[];
      };
      if (!response.ok) {
        if (response.status === 401) {
          window.location.replace("/login?next=%2Fdashboard");
          return;
        }
        throw new Error(result.error ?? "Could not load your GitHub repositories.");
      }
      setRepositories(result.repositories ?? []);
      setSelectedRepository((current) =>
        current && result.repositories?.some((repository) => repository.fullName === current)
          ? current
          : result.repositories?.[0]?.fullName ?? null
      );
    } catch (loadError) {
      setListError(loadError instanceof Error ? loadError.message : "Could not load your GitHub repositories.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (linked) void loadRepositories();
  }, [linked, loadRepositories]);

  const visibleRepositories = repositories.filter((repository) =>
    `${repository.fullName} ${repository.description ?? ""} ${repository.language ?? ""}`
      .toLowerCase()
      .includes(search.trim().toLowerCase())
  );

  if (!linked) {
    return (
      <section className="rounded-xl border border-emerald-300/10 bg-[#141615] p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-300/10 text-emerald-200">
            <Github aria-hidden="true" size={17} />
          </span>
          <div>
            <h2 className="text-sm font-medium text-white">Choose a GitHub repository</h2>
            <p className="mt-1.5 text-xs leading-relaxed text-white/45">
              Connect GitHub first. Then choose from your public repositories here—no URL entry needed.
            </p>
          </div>
        </div>
        <p className="mt-4 text-xs text-white/40">Use the Connect GitHub button above to link your account.</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-emerald-300/10 bg-[#141615] p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-300/10 text-emerald-200">
            <Github aria-hidden="true" size={17} />
          </span>
          <div>
            <h2 className="text-sm font-medium text-white">Choose a public GitHub repository</h2>
            <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-white/45">
              Select one of your public repositories to add it to monitoring. Private repositories are not accessed.
            </p>
          </div>
        </div>
        <button
          className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-white/[0.09] px-3 text-xs text-white/60 transition hover:bg-white/[0.04] disabled:opacity-50"
          disabled={loading}
          onClick={() => void loadRepositories()}
          type="button"
        >
          <RefreshCw aria-hidden="true" className={loading ? "animate-spin" : ""} size={13} />
          Refresh list
        </button>
      </div>
      <label className="mt-4 block">
        <span className="sr-only">Search your GitHub repositories</span>
        <input
          className="h-10 w-full rounded-lg border border-white/[0.09] bg-[#0f1110] px-3 text-xs text-white outline-none placeholder:text-white/30 focus:border-emerald-300/35"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search your repositories"
          value={search}
        />
      </label>
      {listError && <p className="mt-3 text-xs text-rose-200" role="alert">{listError}</p>}
      {error && <p className="mt-3 text-xs text-rose-200" role="alert">{error}</p>}
      {feedback && <p className="mt-3 text-xs text-emerald-200" role="status">{feedback}</p>}
      {loading ? (
        <div className="flex min-h-36 items-center justify-center gap-2 text-xs text-white/45">
          <LoaderCircle aria-hidden="true" className="animate-spin" size={15} /> Loading your public repositories…
        </div>
      ) : visibleRepositories.length ? (
        <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
          {visibleRepositories.map((repository) => {
            const isSelected = repository.fullName === selectedRepository;
            const isImported = importedRepositories.has(repository.fullName.toLowerCase());
            return (
              <li key={repository.fullName}>
                <button
                  aria-pressed={isSelected}
                  className={`flex w-full flex-col gap-2 rounded-lg border p-3 text-left transition sm:flex-row sm:items-center sm:justify-between ${isSelected ? "border-emerald-300/30 bg-emerald-300/[0.05]" : "border-white/[0.07] bg-white/[0.015] hover:bg-white/[0.04]"}`}
                  onClick={() => setSelectedRepository(repository.fullName)}
                  type="button"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium text-white/85">{repository.fullName}</span>
                    <span className="mt-1 block truncate text-[10px] text-white/40">
                      {repository.description || "No description"}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {repository.language && (
                      <span className="rounded-full border border-white/[0.08] px-2 py-1 text-[10px] text-white/45">
                        {repository.language}
                      </span>
                    )}
                    {isImported && (
                      <span className="rounded-full border border-emerald-300/15 px-2 py-1 text-[10px] text-emerald-100/70">
                        Monitoring
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-4 rounded-lg border border-white/[0.06] p-5 text-center text-xs text-white/40">
          {repositories.length
            ? "No repositories match your search."
            : "No public repositories were found for this GitHub account."}
        </p>
      )}
      <div className="mt-4 flex flex-col gap-2 border-t border-white/[0.06] pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[10px] text-white/35">
          {repositories.length} public repositories available · GitHub public metadata only
        </p>
        <button
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-200 px-4 text-xs font-medium text-[#102018] transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-45"
          disabled={!selectedRepository || importing || importedRepositories.has(selectedRepository.toLowerCase())}
          onClick={() => selectedRepository && onImport(selectedRepository)}
          type="button"
        >
          {importing ? <LoaderCircle aria-hidden="true" className="animate-spin" size={14} /> : <ArrowRight aria-hidden="true" size={14} />}
          {importing ? "Adding…" : selectedRepository && importedRepositories.has(selectedRepository.toLowerCase()) ? "Already monitoring" : "Monitor selected project"}
        </button>
      </div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  note,
  icon: Icon,
  tone
}: {
  label: string;
  value: string | number;
  note: string;
  icon: typeof Activity;
  tone: "green" | "amber" | "red" | "neutral";
}) {
  const tones = {
    green: "bg-emerald-300/10 text-emerald-200",
    amber: "bg-amber-300/10 text-amber-200",
    red: "bg-rose-300/10 text-rose-200",
    neutral: "bg-white/[0.06] text-white/70"
  };
  return (
    <article className="rounded-xl border border-white/[0.08] bg-[#141615] p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-white/50">{label}</p>
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tones[tone]}`}>
          <Icon aria-hidden="true" size={16} />
        </span>
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-white">{value}</p>
      <p className="mt-1.5 text-[11px] text-white/40">{note}</p>
    </article>
  );
}

function RepositoryTable({
  tools,
  search,
  statusFilter,
  providerFilter,
  onSearchChange,
  onStatusChange,
  onProviderChange,
  onRecheck,
  onRemove,
  recheckingToolId,
  removingToolId,
  fullPage = false
}: {
  tools: Tool[];
  search: string;
  statusFilter: StatusFilter;
  providerFilter: ProviderFilter;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: StatusFilter) => void;
  onProviderChange: (value: ProviderFilter) => void;
  onRecheck: (tool: Tool) => void;
  onRemove: (tool: Tool) => void;
  recheckingToolId: string | null;
  removingToolId: string | null;
  fullPage?: boolean;
}) {
  const filteredTools = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return tools.filter((tool) => {
      const matchesSearch =
        !normalizedSearch ||
        `${tool.name} ${tool.repository} ${tool.owner}`.toLowerCase().includes(normalizedSearch);
      return (
        matchesSearch &&
        (statusFilter === "all" || tool.status === statusFilter) &&
        (providerFilter === "all" || tool.provider === providerFilter)
      );
    });
  }, [providerFilter, search, statusFilter, tools]);

  return (
    <section className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#141615]">
      <div className="flex flex-col gap-3 border-b border-white/[0.07] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <h2 className="text-sm font-medium text-white">
            {fullPage ? "All repositories" : "Repositories"}
          </h2>
          <p className="mt-1 text-xs text-white/40">
            {filteredTools.length} of {tools.length} repositories
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="relative min-w-0 flex-1 sm:w-52 sm:flex-none">
            <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35" size={14} />
            <span className="sr-only">Search repositories</span>
            <input
              className="h-9 w-full rounded-lg border border-white/[0.09] bg-[#0f1110] pl-9 pr-3 text-xs text-white outline-none placeholder:text-white/30 focus:border-emerald-300/35"
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search repositories"
              value={search}
            />
          </label>
          <label className="relative">
            <ListFilter aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35" size={14} />
            <span className="sr-only">Filter by health status</span>
            <select
              className="h-9 appearance-none rounded-lg border border-white/[0.09] bg-[#0f1110] pl-9 pr-8 text-xs text-white/70 outline-none focus:border-emerald-300/35"
              onChange={(event) => onStatusChange(event.target.value as StatusFilter)}
              value={statusFilter}
            >
              <option value="all">All statuses</option>
              <option value="healthy">Healthy</option>
              <option value="attention">Needs attention</option>
              <option value="critical">Critical</option>
              <option value="not_checked">Not checked</option>
            </select>
            <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-white/35" size={13} />
          </label>
          <label className="relative">
            <span className="sr-only">Filter by provider</span>
            <select
              className="h-9 appearance-none rounded-lg border border-white/[0.09] bg-[#0f1110] px-3 pr-8 text-xs text-white/70 outline-none focus:border-emerald-300/35"
              onChange={(event) => onProviderChange(event.target.value as ProviderFilter)}
              value={providerFilter}
            >
              <option value="all">All sources</option>
              <option value="sample">Sample</option>
              <option value="github">GitHub</option>
            </select>
            <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-white/35" size={13} />
          </label>
        </div>
      </div>

      {filteredTools.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <Search aria-hidden="true" className="mx-auto text-white/25" size={22} />
          <p className="mt-3 text-sm text-white/75">No matching repositories</p>
          <p className="mt-1 text-xs text-white/40">Try another search or status filter.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left">
            <thead>
              <tr className="border-b border-white/[0.06] text-[10px] font-medium uppercase tracking-[0.11em] text-white/35">
                <th className="px-5 py-3 font-medium">Repository</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Health</th>
                <th className="px-4 py-3 font-medium">Owner</th>
                <th className="px-4 py-3 font-medium">Last checked</th>
                <th className="px-5 py-3 text-right font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.055]">
              {filteredTools.map((tool) => (
                <tr className="transition-colors hover:bg-white/[0.025]" key={tool.id}>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-white/55">
                        <GitBranch aria-hidden="true" size={15} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium text-white/90">{tool.name}</span>
                        <span className="mt-1 block truncate font-mono text-[10px] text-white/40">{tool.repository}</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center gap-1.5 text-xs ${tool.provider === "github" ? "text-white/70" : "text-white/40"}`}>
                      {tool.provider === "github" ? <Github aria-hidden="true" size={13} /> : <span className="h-1.5 w-1.5 rounded-full bg-white/25" />}
                      {tool.provider === "github" ? "GitHub" : "Sample"}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    {tool.status === "not_checked" ? (
                      <span className="text-xs text-white/35">—</span>
                    ) : (
                      <div className="flex items-center gap-2">
                      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-white/[0.08]">
                        <span
                          className={`block h-full rounded-full ${
                            tool.healthScore >= 90
                              ? "bg-emerald-300"
                              : tool.healthScore >= 70
                                ? "bg-amber-300"
                                : "bg-rose-300"
                          }`}
                          style={{ width: `${Math.max(0, Math.min(100, tool.healthScore))}%` }}
                        />
                      </span>
                      <span className="text-xs tabular-nums text-white/75">{tool.healthScore}%</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4 text-xs text-white/55">{tool.owner}</td>
                  <td className="px-4 py-4 text-xs text-white/45">
                    {tool.lastCheckedAt ? formatDate(tool.lastCheckedAt) : "Not checked"}
                  </td>
                  <td className="px-5 py-4 text-right"><StatusBadge status={tool.status} /></td>
                  <td className="px-5 py-4">
                    {tool.provider === "github" ? (
                      <div className="flex justify-end gap-2">
                        <button
                          aria-label={`Recheck ${tool.repository}`}
                          className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.09] px-2.5 py-1.5 text-[10px] text-white/65 hover:bg-white/[0.05] disabled:cursor-wait disabled:opacity-45"
                          disabled={recheckingToolId !== null || removingToolId !== null}
                          onClick={() => onRecheck(tool)}
                          type="button"
                        >
                          <RotateCw
                            aria-hidden="true"
                            className={recheckingToolId === tool.id ? "animate-spin" : ""}
                            size={12}
                          />
                          Recheck
                        </button>
                        <button
                          aria-label={`Remove ${tool.repository}`}
                          className="inline-flex items-center gap-1.5 rounded-md border border-rose-300/10 px-2.5 py-1.5 text-[10px] text-rose-200/70 hover:bg-rose-300/[0.06] disabled:cursor-wait disabled:opacity-45"
                          disabled={recheckingToolId !== null || removingToolId !== null}
                          onClick={() => onRemove(tool)}
                          type="button"
                        >
                          <Trash2 aria-hidden="true" size={12} />
                          {removingToolId === tool.id ? "Removing…" : "Remove"}
                        </button>
                      </div>
                    ) : (
                      <span className="block text-right text-[10px] text-white/25">Sample record</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Overview({
  tools,
  findings,
  search,
  statusFilter,
  providerFilter,
  onSearchChange,
  onStatusChange,
  onProviderChange,
  onSectionChange,
  loading,
  error,
  onRetry,
  onRecheck,
  onRemove,
  recheckingToolId,
  removingToolId
}: {
  tools: Tool[];
  findings: Finding[];
  search: string;
  statusFilter: StatusFilter;
  providerFilter: ProviderFilter;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: StatusFilter) => void;
  onProviderChange: (value: ProviderFilter) => void;
  onSectionChange: (section: Section) => void;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onRecheck: (tool: Tool) => void;
  onRemove: (tool: Tool) => void;
  recheckingToolId: string | null;
  removingToolId: string | null;
}) {
  const healthyCount = tools.filter((tool) => tool.status === "healthy").length;
  const attentionCount = tools.filter((tool) => tool.status === "attention").length;
  const criticalCount = tools.filter((tool) => tool.status === "critical").length;
  const scoredTools = tools.filter((tool) => tool.status !== "not_checked");
  const sampleCount = tools.filter((tool) => tool.provider === "sample").length;
  const githubCount = tools.filter((tool) => tool.provider === "github").length;
  const openFindings = findings.filter((finding) => finding.status === "open");
  const recordedChecks = tools.reduce((total, tool) => total + tool.checkRuns.length, 0);
  const recentChecks = tools
    .flatMap((tool) =>
      tool.checkRuns.map((check) => ({ ...check, repository: tool.repository }))
    )
    .sort((left, right) => Date.parse(right.observedAt) - Date.parse(left.observedAt))
    .slice(0, 8);

  if (loading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center gap-3 text-sm text-white/55" role="status">
        <LoaderCircle aria-hidden="true" className="animate-spin text-emerald-200" size={18} />
        Loading workspace records…
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto mt-16 max-w-lg rounded-xl border border-rose-300/15 bg-rose-300/[0.04] p-6 text-center" role="alert">
        <AlertCircle aria-hidden="true" className="mx-auto text-rose-200" size={22} />
        <h2 className="mt-4 text-sm font-medium text-white">Could not load workspace records</h2>
        <p className="mt-2 text-xs leading-relaxed text-white/50">{error}</p>
        <button
          className="mt-5 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-white/75 hover:bg-white/[0.09]"
          onClick={onRetry}
          type="button"
        >
          <RefreshCw aria-hidden="true" size={13} />
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SampleNotice />

      {tools.length === 0 ? (
        <section className="rounded-xl border border-white/[0.08] bg-[#141615] px-6 py-14 text-center">
          <GitBranch aria-hidden="true" className="mx-auto text-white/30" size={24} />
          <h2 className="mt-4 text-sm font-medium text-white">No repository records yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-white/45">
            The API returned an empty workspace. Import a public GitHub repository from Integrations to add live metadata.
          </p>
          <button
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-emerald-200 px-3.5 py-2 text-xs font-medium text-[#102018] hover:bg-emerald-100"
            onClick={() => onSectionChange("integrations")}
            type="button"
          >
            Add a repository
            <ArrowRight aria-hidden="true" size={13} />
          </button>
        </section>
      ) : (
        <>
          <section aria-label="Workspace summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Repositories" value={tools.length} note={`${sampleCount} sample · ${githubCount} monitored GitHub`} icon={GitBranch} tone="neutral" />
            <MetricCard label="Open findings" value={openFindings.length} note="Evidence-backed signals needing review" icon={Shield} tone={openFindings.length ? "amber" : "green"} />
            <MetricCard label="Recent checks" value={recordedChecks} note="Latest 12 checks per repository" icon={Activity} tone="neutral" />
            <MetricCard label="Healthy samples" value={healthyCount} note="Seeded examples only · not live assessments" icon={CheckCircle2} tone="green" />
          </section>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.8fr)]">
            <section className="rounded-xl border border-white/[0.08] bg-[#141615] p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-medium text-white">Health snapshot</h2>
                  <p className="mt-1 text-xs text-white/40">Seeded examples only; GitHub imports are unscored</p>
                </div>
                <span className="rounded-md border border-white/[0.08] px-2 py-1 text-[10px] text-white/45">Sample data</span>
              </div>
              <div className="mt-6 space-y-4">
                {scoredTools.map((tool) => (
                  <div className="grid grid-cols-[minmax(100px,1fr)_2fr_40px] items-center gap-3" key={tool.id}>
                    <span className="truncate text-xs text-white/65">{tool.name}</span>
                    <span className="h-2 overflow-hidden rounded-full bg-white/[0.07]">
                      <span
                        className={`block h-full rounded-full ${
                          tool.healthScore >= 90
                            ? "bg-emerald-300"
                            : tool.healthScore >= 70
                              ? "bg-amber-300"
                              : "bg-rose-300"
                        }`}
                        style={{ width: `${Math.max(0, Math.min(100, tool.healthScore))}%` }}
                      />
                    </span>
                    <span className="text-right text-xs tabular-nums text-white/60">{tool.healthScore}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex flex-wrap gap-4 border-t border-white/[0.07] pt-4 text-[11px] text-white/45">
                <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />Healthy {healthyCount}</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-amber-300" />Attention {attentionCount}</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-rose-300" />Critical {criticalCount}</span>
              </div>
            </section>

            <section className="rounded-xl border border-white/[0.08] bg-[#141615] p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-medium text-white">Open findings</h2>
                  <p className="mt-1 text-xs text-white/40">Signals from completed public-repository checks</p>
                </div>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-300/10 text-amber-200">
                  <AlertCircle aria-hidden="true" size={16} />
                </span>
              </div>
              {openFindings.length ? (
                <ul className="mt-4 divide-y divide-white/[0.06]">
                  {openFindings.slice(0, 3).map((finding) => (
                    <li className="py-3 first:pt-0 last:pb-0" key={finding.id}>
                      <p className="truncate text-xs font-medium text-white/80">
                        {tools.find((tool) => tool.id === finding.toolId)?.repository ?? "Repository"}
                      </p>
                      <p className="mt-1 text-[10px] uppercase tracking-wide text-amber-200/70">
                        {finding.checkType.replaceAll("_", " ")}
                      </p>
                      <p className="mt-1 text-[11px] leading-relaxed text-white/45">{finding.summary}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-5 rounded-lg bg-white/[0.03] p-3 text-xs text-white/45">
                  No open findings. Import or recheck a public GitHub repository to keep its evidence current.
                </p>
              )}
              <button
                className="mt-4 border-t border-white/[0.06] pt-3 text-left text-[10px] text-emerald-200/70 hover:text-emerald-100"
                onClick={() => onSectionChange("findings")}
                type="button"
              >
                Review findings
              </button>
            </section>
          </div>

          <section className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#141615]">
            <div className="border-b border-white/[0.07] p-4 sm:p-5">
              <h2 className="text-sm font-medium text-white">Latest check signals</h2>
              <p className="mt-1 text-xs text-white/40">Evidence recorded by public GitHub lookups</p>
            </div>
            {recentChecks.length ? (
              <ul className="divide-y divide-white/[0.06]">
                {recentChecks.map((check) => (
                  <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5" key={check.id}>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium capitalize text-white/80">
                          {check.checkType.replaceAll("_", " ")}
                        </span>
                        <span className="font-mono text-[10px] text-white/35">{check.repository}</span>
                      </div>
                      <p className="mt-1.5 text-xs text-white/50">{check.summary}</p>
                      <details className="mt-2 text-[10px] text-white/35">
                        <summary className="w-fit cursor-pointer hover:text-white/60">Evidence and limits</summary>
                        <pre className="mt-2 overflow-x-auto rounded-md bg-black/20 p-2 text-[10px] leading-relaxed text-white/45">{check.evidence}</pre>
                      </details>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end">
                      <CheckStatusBadge status={check.status} />
                      <span className="text-[10px] text-white/35">{formatDate(check.observedAt)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-5 text-xs text-white/40">
                No GitHub check signals yet. Import a public repository from Integrations to record its available metadata.
              </p>
            )}
          </section>

          <RepositoryTable
            onRecheck={onRecheck}
            onRemove={onRemove}
            recheckingToolId={recheckingToolId}
            removingToolId={removingToolId}
            onSearchChange={onSearchChange}
            onStatusChange={onStatusChange}
            onProviderChange={onProviderChange}
            providerFilter={providerFilter}
            search={search}
            statusFilter={statusFilter}
            tools={tools}
          />

          <section className="rounded-xl border border-white/[0.08] bg-[#141615] p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-medium text-white">Provider connections</h2>
                <p className="mt-1 text-xs text-white/40">Public GitHub metadata import is available; provider authorization is not configured.</p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-lg border border-white/[0.09] px-3 py-2 text-xs text-white/55">
                No OAuth connections
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {providers.slice(0, 5).map((provider) => (
                <span className="inline-flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-[11px] text-white/50" key={provider.name}>
                  <provider.icon aria-hidden="true" size={13} />
                  {provider.name}
                  <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
                </span>
              ))}
              <button
                className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-[11px] text-emerald-200/70 hover:text-emerald-100"
                onClick={() => onSectionChange("integrations")}
                type="button"
              >
                View all
                <ArrowRight aria-hidden="true" size={12} />
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function FindingsView({
  tools,
  findings,
  updatingFindingId,
  onUpdateStatus
}: {
  tools: Tool[];
  findings: Finding[];
  updatingFindingId: string | null;
  onUpdateStatus: (finding: Finding, status: Finding["status"]) => void;
}) {
  const openFindings = findings.filter((finding) => finding.status === "open");
  const resolvedFindings = findings.filter((finding) => finding.status === "resolved");
  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-white/[0.08] bg-[#141615] p-5 sm:p-7">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-300/10 text-amber-200">
            <Shield aria-hidden="true" size={18} />
          </span>
          <div>
            <h2 className="text-sm font-medium text-white">Evidence-backed findings</h2>
            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-white/50">
              Failed checks create or reopen findings. A passing recheck resolves them automatically; you
              can also resolve or reopen findings for your connected repositories. Sample findings are read-only.
              Unknown checks do not count as failures.
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <MetricCard label="Open" value={openFindings.length} note="Needs review" icon={AlertCircle} tone={openFindings.length ? "amber" : "green"} />
          <MetricCard label="Resolved" value={resolvedFindings.length} note="Passing recheck or manual resolution" icon={CheckCircle2} tone="green" />
          <MetricCard label="Total tracked" value={findings.length} note="One current finding per check type" icon={Shield} tone="neutral" />
        </div>
      </section>
      <section className="rounded-xl border border-white/[0.08] bg-[#141615]">
        <div className="border-b border-white/[0.07] p-5">
          <h2 className="text-sm font-medium text-white">Tracked findings</h2>
          <p className="mt-1 text-xs text-white/40">{findings.length} findings · {tools.filter((tool) => tool.provider === "github").length} public repositories</p>
        </div>
        {findings.length ? (
          <ul className="divide-y divide-white/[0.06]">
            {findings.map((finding) => {
              const tool = tools.find((item) => item.id === finding.toolId);
              const isOpen = finding.status === "open";
              const isSample = tool?.provider === "sample";
              return (
              <li className="flex flex-col gap-4 p-5" key={finding.id}>
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-medium text-white/85">{tool?.repository ?? "Removed repository"}</p>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] ${isOpen ? "border-amber-300/15 bg-amber-300/[0.06] text-amber-100/80" : "border-emerald-300/15 bg-emerald-300/[0.06] text-emerald-100/70"}`}>
                        {isOpen ? "Open" : "Resolved"}
                      </span>
                      <span className="rounded-full border border-white/[0.08] px-2 py-0.5 text-[10px] text-white/45">
                        {finding.checkType.replaceAll("_", " ")}
                      </span>
                      <span className="rounded-full border border-white/[0.08] px-2 py-0.5 text-[10px] text-white/40">
                        {finding.severity}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-white/65">{finding.summary}</p>
                    <p className="mt-2 text-[10px] text-white/35">
                      First seen {formatDate(finding.firstSeenAt)} · Last seen {formatDate(finding.lastSeenAt)}
                      {finding.resolvedAt ? ` · Resolved ${formatDate(finding.resolvedAt)}` : ""}
                    </p>
                  </div>
                  <button
                    className="inline-flex shrink-0 items-center justify-center rounded-lg border border-white/[0.09] px-3 py-2 text-[11px] text-white/65 hover:bg-white/[0.05] disabled:opacity-40"
                    disabled={updatingFindingId !== null || isSample}
                    onClick={() => onUpdateStatus(finding, isOpen ? "resolved" : "open")}
                    type="button"
                  >
                    {isSample ? "Sample · read-only" : updatingFindingId === finding.id ? "Saving…" : isOpen ? "Mark resolved" : "Reopen"}
                  </button>
                </div>
                <details className="text-[10px] text-white/40">
                  <summary className="w-fit cursor-pointer hover:text-white/65">View observed evidence</summary>
                  <pre className="mt-2 overflow-x-auto rounded-md bg-black/20 p-3 text-[10px] leading-relaxed text-white/50">{formatEvidence(finding.evidence)}</pre>
                </details>
              </li>
              );
            })}
          </ul>
        ) : (
          <div className="p-6 text-xs text-white/45">
            No findings yet. Add a public GitHub repository in Integrations; failed checks will appear here with their evidence.
          </div>
        )}
      </section>
    </div>
  );
}

function formatEvidence(value: string) {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function IntegrationsView({
  tools,
  linkedProviders,
  importing,
  feedback,
  error,
  onImport
}: {
  tools: Tool[];
  linkedProviders: string[];
  importing: boolean;
  feedback: string | null;
  error: string | null;
  onImport: (fullName: string) => void;
}) {
  const importedRepositories = new Set(
    tools
      .filter((tool) => tool.provider === "github")
      .map((tool) => tool.repository.toLowerCase())
  );
  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-white/[0.08] bg-[#141615] p-5 sm:p-7">
        <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-emerald-200/70">Account connections</p>
        <h2 className="mt-3 text-xl font-medium tracking-tight text-white">Connect your developer accounts.</h2>
        <p className="mt-2 max-w-2xl text-xs leading-relaxed text-white/50">
          Link GitHub, then select from your public repositories below—no repository URL needed. Private GitHub
          repositories are not included. GitLab OAuth grants read-only account access, but GitLab repository monitoring
          is not available yet.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <a className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/[0.1] px-4 text-xs text-white/75 transition hover:bg-white/[0.05]" href={`${apiBaseUrl}/auth/oauth/github/start?intent=connect`}>
            <Github aria-hidden="true" size={14} /> {linkedProviders.includes("github") ? "Reconnect GitHub" : "Connect GitHub"}
          </a>
          <a className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/[0.1] px-4 text-xs text-white/75 transition hover:bg-white/[0.05]" href={`${apiBaseUrl}/auth/oauth/gitlab/start?intent=connect`}>
            <GitBranch aria-hidden="true" size={14} /> {linkedProviders.includes("gitlab") ? "Reconnect GitLab" : "Connect GitLab"}
          </a>
        </div>
      </section>
      <GitHubRepositoryPicker
        error={error}
        feedback={feedback}
        importing={importing}
        importedRepositories={importedRepositories}
        linked={linkedProviders.includes("github")}
        onImport={onImport}
      />
      <MonitoringFlow />
      <section aria-label="Supported provider roadmap" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {providers.map(({ name, note, icon: Icon }) => (
          <article className="rounded-xl border border-white/[0.08] bg-[#141615] p-4" key={name}>
            <div className="flex items-center justify-between">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.035] text-white/65">
                <Icon aria-hidden="true" size={17} />
              </span>
              <span className={`rounded-full border px-2 py-1 text-[10px] ${name === "GitHub" ? "border-emerald-300/15 bg-emerald-300/[0.05] text-emerald-100/70" : "border-white/[0.08] text-white/40"}`}>
                {name === "GitHub"
                  ? `${tools.filter((tool) => tool.provider === "github").length} imported · ${linkedProviders.includes("github") ? "connected" : "not connected"}`
                  : name === "GitLab" && linkedProviders.includes("gitlab")
                    ? "Account connected"
                    : "Not connected"}
              </span>
            </div>
            <h3 className="mt-4 text-sm font-medium text-white/85">{name}</h3>
            <p className="mt-1 text-[11px] text-white/40">
              {name === "GitHub"
                ? "OAuth sign-in; public repositories imported separately"
                : name === "GitLab"
                  ? "Read-only OAuth account connection"
                  : note}
            </p>
            <p className="mt-4 border-t border-white/[0.06] pt-3 text-[10px] text-white/30">
              {name === "GitHub"
                ? "Public metadata checks · scheduled rechecks"
                : name === "GitLab"
                  ? "Repository monitoring adapter not implemented"
                  : "Adapter not implemented"}
            </p>
          </article>
        ))}
      </section>
    </div>
  );
}

function MonitoringFlow() {
  const steps = [
    ["Choose a repository", "Select a public repository from linked GitHub"],
    ["Collect signals", "Repository, README, latest CI run, release"],
    ["Save evidence", "Timestamped check history in PostgreSQL"],
    ["Track findings", "Failed checks create actionable records"],
    ["Recheck", "Manual or scheduled background refresh"]
  ];
  return (
    <section className="rounded-xl border border-white/[0.08] bg-[#141615] p-5 sm:p-6">
      <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-emerald-200/65">Monitoring architecture</p>
      <h2 className="mt-2 text-sm font-medium text-white">From repository to evidence-backed follow-up</h2>
      <ol className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {steps.map(([title, description], index) => (
          <li className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-3" key={title}>
            <p className="text-[10px] font-mono text-emerald-200/60">0{index + 1}</p>
            <p className="mt-2 text-xs font-medium text-white/85">{title}</p>
            <p className="mt-1 text-[10px] leading-relaxed text-white/40">{description}</p>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-[10px] leading-relaxed text-white/35">
        Checks inspect public GitHub metadata only; source code is not cloned or executed, and the results are not a full security or quality audit.
      </p>
    </section>
  );
}

function SettingsView({
  tools,
  monitorIntervalSeconds
}: {
  tools: Tool[];
  monitorIntervalSeconds: number;
}) {
  const monitoredTools = tools.filter((tool) => tool.provider === "github");
  return (
    <div className="space-y-5">
      <MonitoringFlow />
      <section className="rounded-xl border border-white/[0.08] bg-[#141615] p-5 sm:p-7">
        <h2 className="text-sm font-medium text-white">Workspace settings</h2>
        <p className="mt-1 text-xs text-white/40">Live configuration and monitoring state</p>
        <dl className="mt-6 divide-y divide-white/[0.06]">
          {[
            ["Workspace", "Hacoberfest local workspace"],
            ["Repositories", `${tools.length} total · ${monitoredTools.length} public GitHub imports`],
            ["Data source", "PostgreSQL · timestamped check history and findings"],
            ["API", "Flask GraphQL"],
            ["Provider access", "GitHub public API only · read-only"],
            ["Scheduled recheck", `${formatMonitorInterval(monitorIntervalSeconds)} (monitor service required)`],
            ["Manual recheck", "Available for each imported GitHub repository"],
            ["External write actions", "Disabled · no changes are made to GitHub"]
          ].map(([label, value]) => (
            <div className="flex flex-col gap-1 py-3.5 sm:flex-row sm:items-center sm:justify-between" key={label}>
              <dt className="text-xs text-white/45">{label}</dt>
              <dd className="text-xs text-white/75">{value}</dd>
            </div>
          ))}
        </dl>
        {monitoredTools.length > 0 && (
          <div className="mt-6 border-t border-white/[0.06] pt-4">
            <h3 className="text-xs font-medium text-white/75">Repository check schedule</h3>
            <ul className="mt-3 divide-y divide-white/[0.05]">
              {monitoredTools.map((tool) => (
                <li className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between" key={tool.id}>
                  <span className="text-xs text-white/70">{tool.repository}</span>
                  <span className="text-[10px] text-white/40">
                    {tool.monitoringError
                      ? `Last scheduled check failed: ${tool.monitoringError}`
                      : tool.nextCheckAt
                        ? `Next check ${formatDate(tool.nextCheckAt)}`
                        : tool.lastCheckedAt
                          ? "Waiting for next scheduled check"
                          : "Awaiting first check"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

function formatMonitorInterval(seconds: number) {
  if (seconds % 3600 === 0) {
    const hours = seconds / 3600;
    return `Every ${hours} hour${hours === 1 ? "" : "s"}`;
  }
  return `Every ${seconds / 60} minutes`;
}

export function Dashboard() {
  const [section, setSection] = useState<Section>("overview");
  const [tools, setTools] = useState<Tool[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [monitorIntervalSeconds, setMonitorIntervalSeconds] = useState(86400);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [providerFilter, setProviderFilter] = useState<ProviderFilter>("all");
  const [importing, setImporting] = useState(false);
  const [importFeedback, setImportFeedback] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [recheckingToolId, setRecheckingToolId] = useState<string | null>(null);
  const [removingToolId, setRemovingToolId] = useState<string | null>(null);
  const [updatingFindingId, setUpdatingFindingId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [linkedProviders, setLinkedProviders] = useState<string[]>([]);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [accountRole, setAccountRole] = useState("user");

  const loadTools = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await requestGraphQL(query);
      if (
        !data.tools ||
        !data.findings ||
        typeof data.monitorIntervalSeconds !== "number"
      ) {
        throw new Error("The API response did not include repository records.");
      }
      setTools(data.tools);
      setFindings(data.findings);
      setMonitorIntervalSeconds(data.monitorIntervalSeconds);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "The workspace could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  const importPublicRepository = useCallback(async (fullName: string) => {
    setImporting(true);
    setImportError(null);
    setImportFeedback(null);
    try {
      const data = await requestGraphQL(importPublicRepositoryMutation, {
        fullName
      });
      const imported = data.importPublicRepository;
      if (!imported) {
        throw new Error("The API did not return the imported GitHub repository.");
      }
      setImportFeedback(`Added ${imported.repository}; initial public checks and evidence are saved.`);
      await loadTools();
    } catch (importFailure) {
      setImportError(
        importFailure instanceof Error
          ? importFailure.message
          : "The public GitHub repository could not be imported."
      );
    } finally {
      setImporting(false);
    }
  }, [loadTools]);

  const recheckPublicRepository = useCallback(async (tool: Tool) => {
    setRecheckingToolId(tool.id);
    setActionError(null);
    setActionFeedback(null);
    try {
      const data = await requestGraphQL(recheckRepositoryMutation, { id: tool.id });
      if (data.recheckPublicRepository?.id !== tool.id) {
        throw new Error("The API did not confirm the repository recheck.");
      }
      setActionFeedback(`Updated public checks for ${tool.repository}.`);
      await loadTools();
    } catch (recheckError) {
      setActionError(
        recheckError instanceof Error ? recheckError.message : "The repository could not be rechecked."
      );
    } finally {
      setRecheckingToolId(null);
    }
  }, [loadTools]);

  const removePublicRepository = useCallback(async (tool: Tool) => {
    if (!window.confirm(`Remove ${tool.repository} and its saved check history from this workspace?`)) {
      return;
    }
    setActionError(null);
    setActionFeedback(null);
    setRemovingToolId(tool.id);
    try {
      const data = await requestGraphQL(removeRepositoryMutation, { id: tool.id });
      if (!data.removePublicRepository) {
        throw new Error("The API did not confirm repository removal.");
      }
      setActionFeedback(`Removed ${tool.repository} and its saved workspace data.`);
      await loadTools();
    } catch (removeError) {
      setActionError(
        removeError instanceof Error ? removeError.message : "The repository could not be removed."
      );
    } finally {
      setRemovingToolId(null);
    }
  }, [loadTools]);

  const updateFindingStatus = useCallback(async (finding: Finding, status: Finding["status"]) => {
    setUpdatingFindingId(finding.id);
    setActionError(null);
    setActionFeedback(null);
    try {
      const data = await requestGraphQL(setFindingStatusMutation, {
        id: finding.id,
        status
      });
      if (data.setFindingStatus?.id !== finding.id) {
        throw new Error("The API did not confirm the finding update.");
      }
      setActionFeedback(status === "resolved" ? "Finding marked resolved." : "Finding reopened.");
      await loadTools();
    } catch (updateError) {
      setActionError(
        updateError instanceof Error ? updateError.message : "The finding status could not be updated."
      );
    } finally {
      setUpdatingFindingId(null);
    }
  }, [loadTools]);

  useEffect(() => {
    let active = true;
    void fetch(`${apiBaseUrl}/auth/me`, { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) {
          window.location.replace("/login?next=%2Fdashboard");
          return;
        }
        if (!response.ok) throw new Error("Sign-in status could not be checked.");
        if (active) {
          const identity = (await response.json()) as {
            providers?: string[];
            user?: { email?: string | null; role?: string };
          };
          if (active) {
            setLinkedProviders(identity.providers ?? []);
            setAccountEmail(identity.user?.email ?? null);
            setAccountRole(identity.user?.role ?? "user");
            setAuthReady(true);
            void loadTools();
          }
        }
      })
      .catch((authError) => {
        if (active) {
          setError(authError instanceof Error ? authError.message : "Sign-in status could not be checked.");
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [loadTools]);

  const signOut = async () => {
    try {
      await fetch(`${apiBaseUrl}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } finally {
      window.location.replace("/login");
    }
  };

  useEffect(() => {
    const requestedSection = sections.find(
      (item) => item.id === new URLSearchParams(window.location.search).get("section")
    );
    if (requestedSection) setSection(requestedSection.id);
  }, []);

  const title = sections.find((item) => item.id === section)?.label ?? "Overview";

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0d0f0e] text-sm text-white/60">
        {error ?? "Checking your sign-in…"}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0f0e] text-white lg:pl-[248px]">
      <Sidebar onSectionChange={setSection} section={section} />
      <main className="min-h-screen">
        <header className="sticky top-0 z-20 border-b border-white/[0.07] bg-[#0d0f0e]/90 backdrop-blur-xl">
          <div className="mx-auto flex min-h-[66px] max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-9">
            <div className="min-w-0">
              <p className="truncate text-[11px] text-white/40">Hacoberfest / Workspace</p>
              <h1 className="mt-0.5 text-sm font-medium text-white">{title}</h1>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="hidden items-center gap-1.5 rounded-full border border-sky-300/15 bg-sky-300/[0.05] px-2.5 py-1.5 text-[10px] text-sky-100/75 sm:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-200/70" />
                Prototype
              </span>
              <button
                aria-label="Refresh workspace data"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] text-white/55 transition-colors hover:bg-white/[0.05] hover:text-white disabled:opacity-40"
                disabled={loading}
                onClick={() => void loadTools()}
                type="button"
              >
                <RefreshCw aria-hidden="true" className={loading ? "animate-spin" : ""} size={15} />
              </button>
              <button
                aria-label="Workspace settings"
                className="hidden h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] text-white/55 transition-colors hover:bg-white/[0.05] hover:text-white sm:flex"
                onClick={() => setSection("settings")}
                type="button"
              >
                <Settings2 aria-hidden="true" size={15} />
              </button>
              <button
                aria-label="Sign out"
                className="flex h-9 items-center gap-2 rounded-lg border border-white/[0.08] px-3 text-xs text-white/55 transition-colors hover:bg-white/[0.05] hover:text-white"
                onClick={() => void signOut()}
                type="button"
              >
                <LogOut aria-hidden="true" size={14} />
                <span className="hidden sm:inline">Sign out</span>
              </button>
              {accountRole === "admin" && (
                <a
                  aria-label="Administrator console"
                  className="flex h-9 items-center rounded-lg border border-emerald-300/15 px-3 text-xs text-emerald-100/80 transition-colors hover:bg-emerald-300/[0.06]"
                  href="/admin"
                >
                  Admin
                </a>
              )}
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-200/15 bg-emerald-200/10 text-[11px] font-medium text-emerald-100" title={accountEmail ?? "Signed in"}>TD</span>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1440px] px-4 py-7 sm:px-6 sm:py-8 lg:px-9">
          <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-emerald-200/65">Workspace health</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-[28px]">
                {section === "overview" ? "Repository overview" : title}
              </h2>
              <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-white/45">
                {section === "overview"
                  ? "A clear view of the repository records in your workspace."
                  : section === "repositories"
                    ? "Search, recheck, and remove public GitHub repositories from this workspace."
                    : section === "findings"
                      ? "Review evidence-backed check findings and manage their open or resolved status."
                      : section === "integrations"
                        ? "Add public GitHub repositories and see how their checks flow into findings."
                        : "Review the current monitoring schedule and workspace configuration."}
              </p>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-white/40">
              <Clock3 aria-hidden="true" size={13} />
              Local workspace
            </div>
          </div>

          {(actionError || actionFeedback) && (
            <div
              className={`mb-5 rounded-lg border px-4 py-3 text-xs ${
                actionError
                  ? "border-rose-300/15 bg-rose-300/[0.04] text-rose-100/80"
                  : "border-emerald-300/15 bg-emerald-300/[0.04] text-emerald-100/80"
              }`}
              role={actionError ? "alert" : "status"}
            >
              {actionError ?? actionFeedback}
            </div>
          )}

          {section === "overview" && (
            <Overview
              error={error}
              findings={findings}
              loading={loading}
              onRetry={() => void loadTools()}
              onRecheck={(tool) => void recheckPublicRepository(tool)}
              onRemove={(tool) => void removePublicRepository(tool)}
              removingToolId={removingToolId}
              onSearchChange={setSearch}
              onSectionChange={setSection}
              onStatusChange={setStatusFilter}
              recheckingToolId={recheckingToolId}
              search={search}
              statusFilter={statusFilter}
              providerFilter={providerFilter}
              tools={tools}
              onProviderChange={setProviderFilter}
            />
          )}
          {section === "repositories" && (
            <div className="space-y-5">
              <SampleNotice />
              {error ? (
                <div className="rounded-xl border border-rose-300/15 bg-rose-300/[0.04] p-5" role="alert">
                  <p className="text-sm text-white">Could not load repositories</p>
                  <p className="mt-2 text-xs text-white/50">{error}</p>
                  <button className="mt-3 text-xs text-emerald-200" onClick={() => void loadTools()} type="button">Try again</button>
                </div>
              ) : loading ? (
                <div className="flex min-h-48 items-center justify-center gap-3 text-sm text-white/50">
                  <LoaderCircle aria-hidden="true" className="animate-spin" size={17} />Loading repositories…
                </div>
              ) : (
                <RepositoryTable
                  fullPage
                  onRecheck={(tool) => void recheckPublicRepository(tool)}
                  onRemove={(tool) => void removePublicRepository(tool)}
                  removingToolId={removingToolId}
                  onSearchChange={setSearch}
                  onStatusChange={setStatusFilter}
                  onProviderChange={setProviderFilter}
                  providerFilter={providerFilter}
                  recheckingToolId={recheckingToolId}
                  search={search}
                  statusFilter={statusFilter}
                  tools={tools}
                />
              )}
            </div>
          )}
          {section === "findings" && (
            loading ? (
              <div className="flex min-h-48 items-center justify-center gap-3 text-sm text-white/50">
                <LoaderCircle aria-hidden="true" className="animate-spin" size={17} />Loading workspace…
              </div>
            ) : error ? (
              <div className="rounded-xl border border-rose-300/15 bg-rose-300/[0.04] p-5" role="alert">
                <p className="text-sm text-white">Could not load workspace</p>
                <p className="mt-2 text-xs text-white/50">{error}</p>
              </div>
            ) : (
              <FindingsView
                findings={findings}
                onUpdateStatus={(finding, status) => void updateFindingStatus(finding, status)}
                tools={tools}
                updatingFindingId={updatingFindingId}
              />
            )
          )}
          {section === "integrations" && (
            <IntegrationsView
              error={importError}
              feedback={importFeedback}
              importing={importing}
              onImport={(fullName) => void importPublicRepository(fullName)}
              tools={tools}
              linkedProviders={linkedProviders}
            />
          )}
          {section === "settings" && (
            <SettingsView monitorIntervalSeconds={monitorIntervalSeconds} tools={tools} />
          )}

          <footer className="mt-8 flex flex-col gap-2 border-t border-white/[0.06] pt-4 text-[10px] text-white/30 sm:flex-row sm:items-center sm:justify-between">
            <span>Tool Doctor · Hacktoberfest project</span>
            <span>Sample scores · public GitHub metadata only</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
