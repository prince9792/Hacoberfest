import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen


_REPOSITORY_NAME = re.compile(r"^[A-Za-z0-9_.-]{1,100}/[A-Za-z0-9_.-]{1,100}$")
_API_BASE = "https://api.github.com"


@dataclass(frozen=True)
class CheckEvidence:
    check_type: str
    status: str
    severity: str
    summary: str
    evidence: dict[str, object]


@dataclass(frozen=True)
class PublicRepository:
    full_name: str
    name: str
    owner: str
    url: str
    default_branch: str | None
    archived: bool
    pushed_at: str | None
    checks: tuple[CheckEvidence, ...]


class GitHubPublicAdapter:
    def import_repository(self, full_name: str) -> PublicRepository:
        full_name = self._normalize_repository_name(full_name)
        if (
            not _REPOSITORY_NAME.fullmatch(full_name)
            or any(part in {".", ".."} for part in full_name.split("/"))
        ):
            raise ValueError("Enter a public GitHub repository in owner/repository format.")

        metadata = self._get_json(f"/repos/{full_name}")
        if metadata.get("private") is not False:
            raise ValueError("Only public GitHub repositories can be imported.")

        repository_url = metadata.get("html_url")
        name = metadata.get("name")
        owner_data = metadata.get("owner")
        owner = owner_data.get("login") if isinstance(owner_data, dict) else None
        canonical_full_name = metadata.get("full_name", full_name)
        default_branch = metadata.get("default_branch")
        archived = metadata.get("archived")
        pushed_at = metadata.get("pushed_at")
        parsed_url = urlsplit(repository_url) if isinstance(repository_url, str) else None
        if (
            not all(isinstance(value, str) and value for value in (repository_url, name, owner))
            or parsed_url is None
            or parsed_url.scheme != "https"
            or parsed_url.hostname != "github.com"
            or parsed_url.path.rstrip("/") != f"/{canonical_full_name}"
            or not isinstance(canonical_full_name, str)
            or not _REPOSITORY_NAME.fullmatch(canonical_full_name)
            or canonical_full_name.casefold() != full_name.casefold()
            or (default_branch is not None and not isinstance(default_branch, str))
            or not isinstance(archived, bool)
            or (pushed_at is not None and not isinstance(pushed_at, str))
        ):
            raise RuntimeError("GitHub returned incomplete repository metadata.")

        checks: list[CheckEvidence] = [
            CheckEvidence(
                check_type="availability",
                status="passed",
                severity="informational",
                summary="Public repository metadata is reachable.",
                evidence={
                    "url": repository_url,
                    "visibility": "public",
                    "default_branch": default_branch,
                    "archived": archived,
                    "pushed_at": pushed_at,
                },
            )
        ]

        readme = self._get_optional_json(f"/repos/{full_name}/readme")
        if readme is None:
            checks.append(
                CheckEvidence(
                    check_type="documentation",
                    status="failed",
                    severity="informational",
                    summary="GitHub did not find a README in the repository.",
                    evidence={"url": repository_url, "limitation": "README presence only; links and setup instructions were not checked."},
                )
            )
        else:
            checks.append(
                CheckEvidence(
                    check_type="documentation",
                    status="passed",
                    severity="informational",
                    summary="A README is present.",
                    evidence={"url": readme.get("html_url", repository_url)},
                )
            )

        workflow_data = self._get_optional_json(f"/repos/{full_name}/actions/runs?per_page=1")
        workflow_runs = workflow_data.get("workflow_runs", []) if workflow_data else []
        if workflow_runs and isinstance(workflow_runs[0], dict):
            latest_run = workflow_runs[0]
            conclusion = latest_run.get("conclusion")
            run_status = latest_run.get("status")
            result_status = (
                "passed" if conclusion == "success"
                else "failed" if conclusion in {"failure", "timed_out", "action_required"}
                else "in_progress" if run_status in {"queued", "in_progress"}
                else "not_checked"
            )
            checks.append(
                CheckEvidence(
                    check_type="ci",
                    status=result_status,
                    severity="informational",
                    summary=f"Latest workflow run: {conclusion or run_status or 'unknown'}.",
                    evidence={
                        "url": latest_run.get("html_url", repository_url),
                        "workflow": latest_run.get("name"),
                        "status": run_status,
                        "conclusion": conclusion,
                        "observed_at": latest_run.get("updated_at"),
                        "limitation": "Only the latest GitHub Actions workflow run is inspected; other CI providers are not queried.",
                    },
                )
            )
        else:
            checks.append(
                CheckEvidence(
                    check_type="ci",
                    status="not_checked",
                    severity="informational",
                    summary="No GitHub Actions workflow run was available.",
                    evidence={"url": repository_url, "limitation": "Other CI providers are not inspected."},
                )
            )

        release_data = self._get_optional_json(f"/repos/{full_name}/releases/latest")
        if release_data:
            checks.append(
                CheckEvidence(
                    check_type="release",
                    status="passed",
                    severity="informational",
                    summary="A published GitHub release was found.",
                    evidence={
                        "url": release_data.get("html_url", repository_url),
                        "tag": release_data.get("tag_name"),
                        "published_at": release_data.get("published_at"),
                    },
                )
            )
        else:
            checks.append(
                CheckEvidence(
                    check_type="release",
                    status="not_checked",
                    severity="informational",
                    summary="No latest GitHub release was available.",
                    evidence={"url": repository_url, "limitation": "No release-age policy has been configured."},
                )
            )

        return PublicRepository(
            full_name=canonical_full_name,
            name=name,
            owner=owner,
            url=repository_url,
            default_branch=default_branch,
            archived=archived,
            pushed_at=pushed_at,
            checks=tuple(checks),
        )

    @staticmethod
    def _normalize_repository_name(value: str) -> str:
        value = value.strip()
        if value.startswith(("https://", "http://")):
            parsed_url = urlsplit(value)
            if (
                parsed_url.scheme != "https"
                or parsed_url.hostname != "github.com"
                or parsed_url.username is not None
                or parsed_url.password is not None
                or parsed_url.port is not None
                or parsed_url.query
                or parsed_url.fragment
            ):
                raise ValueError("Enter a github.com HTTPS URL or owner/repository.")
            path = parsed_url.path.strip("/")
            parts = path.split("/")
            if len(parts) != 2:
                raise ValueError("Enter a public GitHub repository URL, not an organization or file URL.")
            value = "/".join(parts)
        if value.endswith(".git"):
            value = value[:-4]
        return value

    def _get_optional_json(self, path: str) -> dict[str, object] | None:
        try:
            return self._get_json(path)
        except LookupError:
            return None

    def _get_json(self, path: str) -> dict[str, object]:
        request = Request(
            f"{_API_BASE}{path}",
            headers={
                "Accept": "application/vnd.github+json",
                "User-Agent": "Tool-Doctor-Local-Prototype",
                "X-GitHub-Api-Version": "2022-11-28",
            },
        )
        try:
            with urlopen(request, timeout=8) as response:
                payload = response.read(1_000_001)
        except HTTPError as error:
            if error.code == 404:
                if path.startswith("/repos/") and path.count("/") == 3:
                    raise ValueError("Repository was not found or is not publicly accessible.") from None
                raise LookupError("GitHub resource was not found.") from None
            if error.code == 403 and error.headers.get("X-RateLimit-Remaining") == "0":
                raise RuntimeError("GitHub's unauthenticated API rate limit was reached. Try again later.") from None
            if error.code == 403:
                if path.startswith("/repos/") and path.count("/") == 3:
                    raise ValueError("Repository was not found or is not publicly accessible.") from None
                raise LookupError("GitHub resource is not available to unauthenticated requests.") from None
            raise RuntimeError(f"GitHub API request failed with HTTP {error.code}.") from None
        except URLError as error:
            raise RuntimeError(f"Could not reach GitHub: {error.reason}.") from None

        if len(payload) > 1_000_000:
            raise RuntimeError("GitHub returned a response that exceeded the 1 MB limit.")
        try:
            result = json.loads(payload)
        except json.JSONDecodeError as error:
            raise RuntimeError("GitHub returned invalid JSON.") from error
        if not isinstance(result, dict):
            raise RuntimeError("GitHub returned an unexpected response.")
        return result


def utc_now() -> datetime:
    return datetime.now(timezone.utc)
