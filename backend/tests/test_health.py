import unittest
import json
from io import BytesIO
from unittest.mock import patch

from app import create_app


class HealthEndpointTests(unittest.TestCase):
    def setUp(self):
        self.client = create_app({"GITHUB_API_TOKEN": "test-token"}).test_client()

    def test_health_endpoint_returns_service_status(self):
        response = self.client.get("/api/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.get_json(),
            {"status": "ok", "service": "tool-doctor-api"},
        )

    @patch("app.providers.github.urlopen")
    def test_github_repository_endpoint_returns_normalized_metadata(self, urlopen):
        urlopen.return_value = BytesIO(
            json.dumps(
                {
                    "id": 123,
                    "full_name": "octocat/Hello-World",
                    "html_url": "https://github.com/octocat/Hello-World",
                    "default_branch": "main",
                    "description": "Example repository",
                    "visibility": "public",
                }
            ).encode()
        )

        response = self.client.get(
            "/api/providers/github/repositories/octocat/Hello-World"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["provider"], "github")
        self.assertEqual(response.get_json()["external_id"], "123")
        self.assertEqual(response.get_json()["full_name"], "octocat/Hello-World")
        request = urlopen.call_args.args[0]
        self.assertEqual(request.get_header("Authorization"), "Bearer test-token")

    @patch("app.providers.github.urlopen")
    def test_github_repository_endpoint_reports_missing_repository(self, urlopen):
        from urllib.error import HTTPError

        urlopen.side_effect = HTTPError(
            "https://api.github.com/repos/missing/repository",
            404,
            "Not Found",
            {},
            None,
        )

        response = self.client.get(
            "/api/providers/github/repositories/missing/repository"
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.get_json(), {"error": "GitHub repository not found."})


if __name__ == "__main__":
    unittest.main()
