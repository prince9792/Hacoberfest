from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class ProviderCapabilities:
    repository_metadata: bool = True
    ci_status: bool = False
    releases: bool = False
    dependency_alerts: bool = False
    webhooks: bool = False
    write_actions: bool = False


@dataclass(frozen=True)
class RepositoryMetadata:
    provider: str
    external_id: str
    full_name: str
    url: str
    default_branch: str | None
    description: str | None
    visibility: str | None


class ProviderAdapter(Protocol):
    provider_name: str
    capabilities: ProviderCapabilities

    def get_repository_metadata(self, external_id: str) -> RepositoryMetadata:
        """Fetch normalized repository metadata from the provider."""
        ...
