import json
import unittest
from unittest.mock import patch

from github_adapter import GitHubPublicAdapter


class FakeResponse:
    def __init__(self, payload: dict[str, object]):
        self.payload = json.dumps(payload).encode()

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self, _limit: int) -> bytes:
        return self.payload


class GitHubPublicAdapterTests(unittest.TestCase):
    def test_rejects_non_repository_input_before_network_access(self):
        with patch("github_adapter.urlopen") as open_url:
            with self.assertRaisesRegex(ValueError, "owner/repository"):
                GitHubPublicAdapter().import_repository("https://example.com/owner/repo")
        open_url.assert_not_called()

    def test_accepts_canonical_public_github_url(self):
        metadata = FakeResponse(
            {
                "private": False,
                "full_name": "octocat/Hello-World",
                "name": "Hello-World",
                "owner": {"login": "octocat"},
                "html_url": "https://github.com/octocat/Hello-World",
                "default_branch": "main",
                "archived": False,
                "pushed_at": "2026-10-22T12:00:00Z",
            }
        )
        optional_resources = [
            FakeResponse({"html_url": "https://github.com/octocat/Hello-World/README.md"}),
            FakeResponse({"workflow_runs": []}),
            FakeResponse({"tag_name": "v1.0"}),
        ]
        with patch("github_adapter.urlopen", side_effect=[metadata, *optional_resources]) as open_url:
            repository = GitHubPublicAdapter().import_repository(
                "https://github.com/octocat/Hello-World.git"
            )

        self.assertEqual(repository.full_name, "octocat/Hello-World")
        self.assertEqual(open_url.call_count, 4)

    def test_rejects_github_url_with_query_or_credentials_before_network_access(self):
        for value in (
            "https://github.com/octocat/Hello-World?token=secret",
            "https://user@github.com/octocat/Hello-World",
            "https://github.com.evil.example/octocat/Hello-World",
        ):
            with self.subTest(value=value), patch("github_adapter.urlopen") as open_url:
                with self.assertRaises(ValueError):
                    GitHubPublicAdapter().import_repository(value)
                open_url.assert_not_called()

    def test_imports_public_metadata_and_check_evidence(self):
        responses = [
            FakeResponse(
                {
                    "private": False,
                    "full_name": "octocat/Hello-World",
                    "name": "Hello-World",
                    "owner": {"login": "octocat"},
                    "html_url": "https://github.com/octocat/Hello-World",
                    "default_branch": "main",
                    "archived": False,
                    "pushed_at": "2026-10-22T12:00:00Z",
                }
            ),
            FakeResponse({"html_url": "https://github.com/octocat/Hello-World/blob/main/README.md"}),
            FakeResponse(
                {
                    "workflow_runs": [
                        {
                            "name": "CI",
                            "status": "completed",
                            "conclusion": "success",
                            "html_url": "https://github.com/octocat/Hello-World/actions/runs/1",
                            "updated_at": "2026-10-22T12:00:00Z",
                        }
                    ]
                }
            ),
            FakeResponse(
                {
                    "tag_name": "v1.0",
                    "html_url": "https://github.com/octocat/Hello-World/releases/tag/v1.0",
                    "published_at": "2026-10-22T12:00:00Z",
                }
            ),
        ]
        with patch("github_adapter.urlopen", side_effect=responses):
            repository = GitHubPublicAdapter().import_repository("octocat/Hello-World")

        self.assertEqual(repository.full_name, "octocat/Hello-World")
        self.assertEqual(repository.owner, "octocat")
        self.assertEqual(repository.checks[0].evidence["default_branch"], "main")
        self.assertFalse(repository.checks[0].evidence["archived"])
        self.assertEqual(
            repository.checks[0].evidence["pushed_at"],
            "2026-10-22T12:00:00Z",
        )
        self.assertEqual(
            [check.check_type for check in repository.checks],
            ["availability", "documentation", "ci", "release"],
        )
        self.assertEqual(repository.checks[2].status, "passed")
        self.assertIn("other CI providers", repository.checks[2].evidence["limitation"])

    def test_does_not_import_private_repositories(self):
        with patch(
            "github_adapter.urlopen",
            return_value=FakeResponse({"private": True}),
        ):
            with self.assertRaisesRegex(ValueError, "Only public"):
                GitHubPublicAdapter().import_repository("octocat/private-repo")


if __name__ == "__main__":
    unittest.main()
