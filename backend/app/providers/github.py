import json
from dataclasses import asdict
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from app.providers.base import ProviderCapabilities, RepositoryMetadata


class GitHubRepositoryNotFound(Exception):
    pass


class GitHubProviderUnavailable(Exception):
    pass


class GitHubAdapter:
    provider_name = "github"
    capabilities = ProviderCapabilities(
        repository_metadata=True,
        ci_status=True,
        releases=True,
    )

    def __init__(self, api_token: str = ""):
        self.api_token = api_token

    def get_repository_metadata(self, external_id: str) -> RepositoryMetadata:
        parts = external_id.strip("/").split("/", maxsplit=1)
        if len(parts) != 2 or not all(parts):
            raise ValueError('Repository must use the "owner/repository" format.')

        owner, repository = parts
        url = (
            "https://api.github.com/repos/"
            f"{quote(owner, safe='')}/{quote(repository, safe='')}"
        )
        headers = {
            "Accept": "application/vnd.github+json",
            "User-Agent": "Tool-Doctor",
        }
        if self.api_token:
            headers["Authorization"] = f"Bearer {self.api_token}"

        request = Request(url, headers=headers)
        try:
            with urlopen(request, timeout=10) as response:
                data = json.load(response)
        except HTTPError as exc:
            if exc.code == 404:
                raise GitHubRepositoryNotFound from exc
            raise GitHubProviderUnavailable from exc
        except (
            URLError,
            TimeoutError,
            json.JSONDecodeError,
            UnicodeDecodeError,
        ) as exc:
            raise GitHubProviderUnavailable from exc

        if not isinstance(data, dict):
            raise GitHubProviderUnavailable
        try:
            repository_id = data["id"]
            full_name = data["full_name"]
            repository_url = data["html_url"]
            if not isinstance(full_name, str) or not isinstance(repository_url, str):
                raise GitHubProviderUnavailable
        except KeyError as exc:
            raise GitHubProviderUnavailable from exc

        return RepositoryMetadata(
            provider=self.provider_name,
            external_id=str(repository_id),
            full_name=full_name,
            url=repository_url,
            default_branch=data.get("default_branch"),
            description=data.get("description"),
            visibility=data.get("visibility"),
        )


def serialize_repository(metadata: RepositoryMetadata) -> dict[str, object]:
    return asdict(metadata)
