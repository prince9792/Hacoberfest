from flask import Blueprint, current_app, jsonify

from app.providers.github import (
    GitHubAdapter,
    GitHubProviderUnavailable,
    GitHubRepositoryNotFound,
    serialize_repository,
)

providers_blueprint = Blueprint("providers", __name__, url_prefix="/providers")


@providers_blueprint.get("/github/repositories/<owner>/<repository>")
def get_github_repository(owner: str, repository: str):
    adapter = GitHubAdapter(api_token=current_app.config["GITHUB_API_TOKEN"])
    try:
        metadata = adapter.get_repository_metadata(f"{owner}/{repository}")
    except GitHubRepositoryNotFound:
        return jsonify({"error": "GitHub repository not found."}), 404
    except GitHubProviderUnavailable:
        return jsonify({"error": "GitHub API is temporarily unavailable."}), 502
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify(serialize_repository(metadata))
