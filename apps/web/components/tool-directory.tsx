"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, LoaderCircle, RefreshCw } from "lucide-react";

type Tool = {
  id: string;
  name: string;
  repository: string;
  status: "healthy" | "attention" | "critical" | "not_checked";
  healthScore: number;
  summary: string;
  owner: string;
};

type GraphQLResponse = {
  data?: { tools?: Tool[] };
  errors?: Array<{ message: string }>;
};

const query = `query ToolDirectory {
  tools {
    id
    name
    repository
    status
    healthScore
    summary
    owner
  }
}`;

const statusLabels: Record<Tool["status"], string> = {
  healthy: "Healthy",
  attention: "Needs attention",
  critical: "Critical",
  not_checked: "Not checked"
};

export function ToolDirectory() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTools = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/graphql",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
          cache: "no-store"
        }
      );
      if (!response.ok) {
        throw new Error(`The tool directory request failed with HTTP ${response.status}.`);
      }
      const result = (await response.json()) as GraphQLResponse;
      if (result.errors?.length) {
        throw new Error(result.errors.map((item) => item.message).join(" "));
      }
      if (!result.data?.tools) {
        throw new Error("The API response did not include a tool directory.");
      }
      setTools(result.data.tools);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "The tool directory could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTools();
  }, [loadTools]);

  return (
    <div className="w-full max-w-md rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-md sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/60">
            Explore tools
          </p>
          <h2 className="mt-2 text-lg font-medium text-white">Workspace health</h2>
        </div>
        <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-white/70">
          Local workspace
        </span>
      </div>

      {loading ? (
        <div className="flex min-h-36 items-center justify-center gap-2 text-sm text-white/65">
          <LoaderCircle aria-hidden="true" className="animate-spin" size={16} />
          Loading repository health
        </div>
      ) : error ? (
        <div
          aria-live="polite"
          className="rounded-xl border border-white/15 bg-black/20 p-4"
          role="status"
        >
          <p className="text-sm font-medium text-white">Tool directory unavailable</p>
          <p className="mt-1 text-xs leading-relaxed text-white/65">{error}</p>
          <button
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs text-white transition-colors duration-300 hover:bg-white/20"
            onClick={() => void loadTools()}
            type="button"
          >
            <RefreshCw aria-hidden="true" size={13} />
            Try again
          </button>
        </div>
      ) : tools.length === 0 ? (
        <p className="rounded-xl border border-white/15 bg-black/20 p-4 text-sm text-white/65">
          No tools have been added to this workspace yet.
        </p>
      ) : (
        <ul className="divide-y divide-white/15">
          {tools.map((tool) => (
            <li className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0" key={tool.id}>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      tool.status === "healthy"
                        ? "bg-emerald-300"
                        : tool.status === "critical"
                          ? "bg-rose-300"
                          : "bg-amber-200"
                    }`}
                  />
                  <p className="truncate text-sm font-medium text-white">{tool.name}</p>
                </div>
                <p className="mt-1 truncate pl-3.5 font-mono text-[10px] tracking-wide text-white/55">
                  {tool.repository}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm text-white">
                  {tool.status === "not_checked" ? "—" : `${tool.healthScore}%`}
                </p>
                <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.1em] text-white/55">
                  {statusLabels[tool.status]}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <a
        className="mt-5 inline-flex items-center gap-2 text-xs text-white/75 transition-colors duration-300 hover:text-white"
        href="#how-it-works"
      >
        How the checks work
        <ArrowUpRight aria-hidden="true" size={14} />
      </a>
    </div>
  );
}
