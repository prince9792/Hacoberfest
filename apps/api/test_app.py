import json
import hashlib
import urllib.parse
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from sqlalchemy import inspect, select, text

from app import CheckRunRecord, FindingRecord, ToolRecord, create_app
from auth import AuthSessionRecord, OAuthIdentityRecord, UserRecord
from github_adapter import CheckEvidence, PublicRepository


class AppDatabaseTests(unittest.TestCase):
    def setUp(self):
        self.app = create_app(
            {
                "DATABASE_URL": "sqlite://",
                "REDIS_URL": "redis://localhost:6379/0",
                "TESTING": True,
                "AUTH_REQUIRED": False,
            }
        )
        self.client = self.app.test_client()
        self.engine = self.app.extensions["tool_doctor_engine"]

    def tearDown(self):
        self.engine.dispose()

    def initialize_database(self):
        result = self.app.test_cli_runner().invoke(args=["init-db"])
        self.assertEqual(result.exit_code, 0, result.output)

    def test_init_db_migrates_legacy_tools_table(self):
        with self.engine.begin() as connection:
            connection.execute(
                text(
                    "CREATE TABLE tools ("
                    "id VARCHAR(36) PRIMARY KEY, "
                    "name VARCHAR(120) NOT NULL, "
                    "repository VARCHAR(255) NOT NULL UNIQUE, "
                    "status VARCHAR(20) NOT NULL, "
                    "health_score INTEGER NOT NULL, "
                    "summary VARCHAR(500) NOT NULL, "
                    "owner VARCHAR(120) NOT NULL, "
                    "updated_at DATETIME NOT NULL)"
                )
            )

        self.initialize_database()

        columns = {column["name"] for column in inspect(self.engine).get_columns("tools")}
        self.assertIn("provider", columns)
        self.assertIn("last_checked_at", columns)
        self.assertIn("next_check_at", columns)
        self.assertIn("check_runs", inspect(self.engine).get_table_names())
        self.assertIn("findings", inspect(self.engine).get_table_names())
        with self.engine.connect() as connection:
            indexes = connection.exec_driver_sql("PRAGMA index_list('tools')").all()
            unique_columns = []
            for index in indexes:
                if index[2]:
                    unique_columns.append(
                        [
                            column[2]
                            for column in connection.exec_driver_sql(
                                f'PRAGMA index_info("{index[1]}")'
                            ).all()
                        ]
                    )
        self.assertIn(["owner_user_id", "repository"], unique_columns)
        self.assertNotIn(["repository"], unique_columns)
        with self.app.extensions["tool_doctor_session_factory"]() as session:
            records = session.scalars(select(ToolRecord)).all()
        self.assertEqual(len(records), 3)
        self.assertTrue(all(record.provider == "sample" for record in records))

    def test_public_import_persists_check_evidence(self):
        self.initialize_database()
        repository = PublicRepository(
            full_name="example/project",
            name="project",
            owner="example",
            url="https://github.com/example/project",
            default_branch="main",
            archived=False,
            pushed_at="2026-01-01T00:00:00Z",
            checks=(
                CheckEvidence(
                    check_type="availability",
                    status="passed",
                    severity="informational",
                    summary="Repository is public.",
                    evidence={"url": "https://github.com/example/project"},
                ),
            ),
        )
        query = """
            mutation {
              importPublicRepository(fullName: "example/project") {
                repository
                provider
                status
                checkRuns {
                  checkType
                  status
                  evidence
                }
              }
            }
        """

        with patch("app.GitHubPublicAdapter.import_repository", return_value=repository):
            response = self.client.post("/graphql", json={"query": query})

        payload = response.get_json()
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("errors", payload)
        tool = payload["data"]["importPublicRepository"]
        self.assertEqual(tool["repository"], "example/project")
        self.assertEqual(tool["provider"], "github")
        self.assertEqual(tool["status"], "not_checked")
        self.assertEqual(tool["checkRuns"][0]["checkType"], "availability")
        self.assertEqual(
            json.loads(tool["checkRuns"][0]["evidence"]),
            {"url": "https://github.com/example/project"},
        )
        with self.app.extensions["tool_doctor_session_factory"]() as session:
            records = session.scalars(select(CheckRunRecord)).all()
        self.assertEqual(len(records), 1)

    def test_failed_check_creates_finding_and_a_passing_recheck_resolves_it(self):
        self.initialize_database()
        failing_repository = PublicRepository(
            full_name="example/project",
            name="project",
            owner="example",
            url="https://github.com/example/project",
            default_branch="main",
            archived=False,
            pushed_at="2026-01-01T00:00:00Z",
            checks=(
                CheckEvidence(
                    check_type="documentation",
                    status="failed",
                    severity="informational",
                    summary="GitHub did not find a README.",
                    evidence={"url": "https://github.com/example/project"},
                ),
            ),
        )
        passing_repository = PublicRepository(
            **{
                **failing_repository.__dict__,
                "checks": (
                    CheckEvidence(
                        check_type="documentation",
                        status="passed",
                        severity="informational",
                        summary="A README is present.",
                        evidence={"url": "https://github.com/example/project/README.md"},
                    ),
                ),
            }
        )
        import_query = """
            mutation {
              importPublicRepository(fullName: "example/project") { id }
            }
        """
        with patch("app.GitHubPublicAdapter.import_repository", return_value=failing_repository):
            imported = self.client.post("/graphql", json={"query": import_query}).get_json()
        self.assertNotIn("errors", imported)
        tool_id = imported["data"]["importPublicRepository"]["id"]
        findings_query = """
            query {
              findings {
                id
                toolId
                checkType
                status
                summary
                firstSeenAt
                lastSeenAt
                resolvedAt
              }
            }
        """
        findings = self.client.post("/graphql", json={"query": findings_query}).get_json()
        finding = findings["data"]["findings"][0]
        self.assertEqual(finding["toolId"], tool_id)
        self.assertEqual(finding["checkType"], "documentation")
        self.assertEqual(finding["status"], "open")
        self.assertIsNone(finding["resolvedAt"])

        recheck_query = """
            mutation Recheck($id: ID!) {
              recheckPublicRepository(id: $id) { id lastCheckedAt nextCheckAt }
            }
        """
        with patch("app.GitHubPublicAdapter.import_repository", return_value=passing_repository):
            rechecked = self.client.post(
                "/graphql",
                json={"query": recheck_query, "variables": {"id": tool_id}},
            ).get_json()
        self.assertNotIn("errors", rechecked)
        self.assertEqual(rechecked["data"]["recheckPublicRepository"]["id"], tool_id)
        findings = self.client.post("/graphql", json={"query": findings_query}).get_json()
        self.assertEqual(findings["data"]["findings"][0]["status"], "resolved")
        self.assertIsNotNone(findings["data"]["findings"][0]["resolvedAt"])
        with self.app.extensions["tool_doctor_session_factory"]() as session:
            check_runs = session.scalars(select(CheckRunRecord)).all()
            saved_findings = session.scalars(select(FindingRecord)).all()
        self.assertEqual(len(check_runs), 2)
        self.assertEqual(len(saved_findings), 1)

    def test_finding_can_be_resolved_and_reopened_by_user(self):
        self.initialize_database()
        with self.app.extensions["tool_doctor_session_factory"]() as session:
            tool = ToolRecord(
                name="project",
                repository="example/project",
                status="not_checked",
                health_score=0,
                summary="Public repository",
                owner="example",
                provider="github",
            )
            session.add(tool)
            session.flush()
            finding = FindingRecord(
                tool_id=tool.id,
                check_type="documentation",
                status="open",
                severity="informational",
                summary="README missing.",
                evidence="{}",
                first_seen_at=datetime.now(timezone.utc),
                last_seen_at=datetime.now(timezone.utc),
            )
            session.add(finding)
            session.commit()
            finding_id = finding.id

        mutation = """
            mutation SetStatus($id: ID!, $status: String!) {
              setFindingStatus(id: $id, status: $status) { id status resolvedAt }
            }
        """
        resolved = self.client.post(
            "/graphql",
            json={"query": mutation, "variables": {"id": finding_id, "status": "resolved"}},
        ).get_json()
        self.assertNotIn("errors", resolved)
        self.assertEqual(resolved["data"]["setFindingStatus"]["status"], "resolved")
        reopened = self.client.post(
            "/graphql",
            json={"query": mutation, "variables": {"id": finding_id, "status": "open"}},
        ).get_json()
        self.assertNotIn("errors", reopened)
        self.assertEqual(reopened["data"]["setFindingStatus"]["status"], "open")
        self.assertIsNone(reopened["data"]["setFindingStatus"]["resolvedAt"])

    def test_background_monitor_selects_due_github_repositories(self):
        self.initialize_database()
        due_at = datetime.now(timezone.utc) - timedelta(minutes=1)
        with self.app.extensions["tool_doctor_session_factory"]() as session:
            session.add(
                ToolRecord(
                    name="project",
                    repository="example/project",
                    status="not_checked",
                    health_score=0,
                    summary="Public repository",
                    owner="example",
                    provider="github",
                    next_check_at=due_at,
                )
            )
            session.commit()

        from monitor import run_due_checks

        with patch("monitor.app", self.app), patch("monitor.import_or_refresh_repository") as refresh:
            checked = run_due_checks()

        self.assertEqual(checked, 1)
        refresh.assert_called_once_with(
            self.app.extensions["tool_doctor_session_factory"],
            "example/project",
            self.app.config["MONITOR_INTERVAL_SECONDS"],
            allow_create=False,
            owner_user_id=None,
        )

    def test_remove_public_repository_deletes_its_saved_workspace_data(self):
        self.initialize_database()
        now = datetime.now(timezone.utc)
        with self.app.extensions["tool_doctor_session_factory"]() as session:
            tool = ToolRecord(
                name="project",
                repository="example/project",
                status="not_checked",
                health_score=0,
                summary="Public repository",
                owner="example",
                provider="github",
            )
            session.add(tool)
            session.flush()
            session.add(
                CheckRunRecord(
                    tool_id=tool.id,
                    check_type="availability",
                    status="passed",
                    severity="informational",
                    summary="Reachable",
                    evidence="{}",
                    observed_at=now,
                )
            )
            session.add(
                FindingRecord(
                    tool_id=tool.id,
                    check_type="documentation",
                    status="open",
                    severity="informational",
                    summary="README missing",
                    evidence="{}",
                    first_seen_at=now,
                    last_seen_at=now,
                )
            )
            session.commit()
            tool_id = tool.id

        mutation = """
            mutation Remove($id: ID!) {
              removePublicRepository(id: $id)
            }
        """
        response = self.client.post(
            "/graphql",
            json={"query": mutation, "variables": {"id": tool_id}},
        ).get_json()
        self.assertNotIn("errors", response)
        self.assertTrue(response["data"]["removePublicRepository"])
        with self.app.extensions["tool_doctor_session_factory"]() as session:
            self.assertIsNone(session.get(ToolRecord, tool_id))
            self.assertEqual(session.scalars(select(CheckRunRecord)).all(), [])
            self.assertEqual(session.scalars(select(FindingRecord)).all(), [])

    def test_workspace_query_exposes_configured_monitor_interval(self):
        self.initialize_database()
        response = self.client.post(
            "/graphql",
            json={"query": "{ monitorIntervalSeconds }"},
        ).get_json()
        self.assertNotIn("errors", response)
        self.assertEqual(response["data"]["monitorIntervalSeconds"], 86400)


class AuthenticationTests(unittest.TestCase):
    def setUp(self):
        self.app = create_app(
            {
                "DATABASE_URL": "sqlite://",
                "REDIS_URL": "redis://localhost:6379/0",
                "TESTING": True,
                "AUTH_REQUIRED": True,
                "AUTH_SECRET": "test-auth-secret-that-is-at-least-32-characters",
                "SMTP_HOST": "mail.example.test",
                "SMTP_FROM": "Tool Doctor <noreply@example.test>",
                "GITHUB_CLIENT_ID": "test-github-client",
                "GITHUB_CLIENT_SECRET": "test-github-secret",
                "ADMIN_EMAIL": "admin@example.com",
                "ADMIN_PASSWORD": "test-admin-password-long-enough",
                "ADMIN_NAME": "Test Administrator",
            }
        )
        self.engine = self.app.extensions["tool_doctor_engine"]
        self.factory = self.app.extensions["tool_doctor_session_factory"]
        result = self.app.test_cli_runner().invoke(args=["init-db"])
        self.assertEqual(result.exit_code, 0, result.output)

    def tearDown(self):
        self.engine.dispose()

    def test_workspace_api_requires_a_valid_session(self):
        client = self.app.test_client()
        response = client.post("/graphql", json={"query": "{ tools { id } }"})
        self.assertEqual(response.status_code, 401)
        self.assertEqual(client.get("/auth/me").status_code, 401)
        preflight = client.options(
            "/graphql",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )
        self.assertEqual(preflight.status_code, 200)
        self.assertEqual(preflight.headers.get("Access-Control-Allow-Origin"), "http://localhost:3000")
        auth_preflight = client.options(
            "/auth/otp/request",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )
        self.assertEqual(auth_preflight.status_code, 200)
        self.assertEqual(
            auth_preflight.headers.get("Access-Control-Allow-Origin"),
            "http://localhost:3000",
        )

    def test_email_otp_signs_in_and_sets_http_only_session_cookie(self):
        client = self.app.test_client()
        with patch("auth.smtplib.SMTP") as smtp:
            requested = client.post(
                "/auth/otp/request",
                json={"channel": "email", "destination": "dev@example.com"},
            )
            self.assertEqual(requested.status_code, 200, requested.get_json())
            message = smtp.return_value.__enter__.return_value.send_message.call_args.args[0]
            sent_code = message.get_content().split("verification code is ")[1][:6]
            verified = client.post(
                "/auth/otp/verify",
                json={
                    "challengeId": requested.get_json()["challengeId"],
                    "code": sent_code,
                },
            )
        self.assertEqual(verified.status_code, 200, verified.get_json())
        cookie = verified.headers["Set-Cookie"]
        self.assertIn("HttpOnly", cookie)
        self.assertIn("tool_doctor_session=", cookie)
        self.assertEqual(client.get("/auth/me").get_json()["user"]["email"], "dev@example.com")
        self.assertEqual(client.post("/graphql", json={"query": "{ tools { id } }"}).status_code, 200)

    def test_registration_captures_profile_and_password_and_logs_in(self):
        client = self.app.test_client()
        response = client.post(
            "/auth/register",
            json={
                "name": "Taylor Developer",
                "email": "Taylor@example.com",
                "mobile": "+14155550123",
                "organization": "Example Co",
                "jobTitle": "Software Engineer",
                "password": "a-long-test-password-123",
            },
        )
        self.assertEqual(response.status_code, 201, response.get_json())
        self.assertEqual(response.get_json()["role"], "user")
        self.assertIn("HttpOnly", response.headers["Set-Cookie"])
        profile = client.get("/auth/me").get_json()["user"]
        self.assertEqual(profile["name"], "Taylor Developer")
        self.assertEqual(profile["email"], "taylor@example.com")
        self.assertEqual(profile["phone"], "+14155550123")
        self.assertEqual(profile["organization"], "Example Co")
        self.assertEqual(profile["jobTitle"], "Software Engineer")
        self.assertEqual(profile["role"], "user")
        with self.factory() as session:
            user = session.scalar(select(UserRecord).where(UserRecord.email == "taylor@example.com"))
            self.assertNotEqual(user.password_hash, "a-long-test-password-123")
            self.assertIsNotNone(user.password_hash)

        client.post("/auth/logout")
        duplicate = client.post(
            "/auth/register",
            json={
                "name": "Taylor Developer",
                "email": "taylor@example.com",
                "mobile": "+14155550124",
                "password": "a-long-test-password-123",
            },
        )
        self.assertEqual(duplicate.status_code, 409)
        login = client.post(
            "/auth/login",
            json={"email": "TAYLOR@example.com", "password": "a-long-test-password-123"},
        )
        self.assertEqual(login.status_code, 200, login.get_json())
        self.assertEqual(login.get_json()["role"], "user")
        bad_login = self.app.test_client().post(
            "/auth/login",
            json={"email": "taylor@example.com", "password": "wrong-password"},
        )
        self.assertEqual(bad_login.status_code, 401)

    def test_bootstrapped_admin_can_sign_in_and_view_users_but_users_cannot(self):
        with self.factory() as session:
            admin = session.scalar(select(UserRecord).where(UserRecord.email == "admin@example.com"))
            self.assertIsNotNone(admin)
            self.assertEqual(admin.role, "admin")
            self.assertEqual(admin.full_name, "Test Administrator")

        admin_client = self.app.test_client()
        login = admin_client.post(
            "/auth/login",
            json={"email": "admin@example.com", "password": "test-admin-password-long-enough"},
        )
        self.assertEqual(login.status_code, 200, login.get_json())
        self.assertEqual(login.get_json()["role"], "admin")
        response = admin_client.get("/auth/admin/users")
        self.assertEqual(response.status_code, 200, response.get_json())
        self.assertEqual(response.get_json()["users"][0]["role"], "admin")

        user_client = self.app.test_client()
        user_client.post(
            "/auth/register",
            json={
                "name": "Regular User",
                "email": "regular@example.com",
                "mobile": "+14155550188",
                "password": "a-long-test-password-456",
            },
        )
        denied = user_client.get("/auth/admin/users")
        self.assertEqual(denied.status_code, 403)

    def test_registration_rejects_short_password_and_invalid_phone(self):
        client = self.app.test_client()
        payload = {
            "name": "Test User",
            "email": "test@example.com",
            "mobile": "+14155550123",
            "password": "short",
        }
        self.assertEqual(client.post("/auth/register", json=payload).status_code, 400)
        payload["password"] = "a-long-test-password-123"
        payload["mobile"] = "5551234"
        self.assertEqual(client.post("/auth/register", json=payload).status_code, 400)

    def test_github_oauth_uses_one_time_state_and_creates_session(self):
        from unittest.mock import Mock

        client = self.app.test_client()
        start = client.get("/auth/oauth/github/start")
        query = urllib.parse.parse_qs(urllib.parse.urlparse(start.location).query)
        self.assertEqual(query["scope"], ["read:user user:email"])
        state = query["state"][0]

        def provider_response(payload):
            response = Mock()
            response.__enter__ = Mock(return_value=response)
            response.__exit__ = Mock(return_value=False)
            response.read.return_value = json.dumps(payload).encode()
            return response

        with patch(
            "auth.urllib.request.urlopen",
            side_effect=[
                provider_response({"access_token": "provider-access-token"}),
                provider_response({"id": 98765, "login": "developer"}),
            ],
        ) as urlopen:
            callback = client.get(
                "/auth/oauth/github/callback",
                query_string={"state": state, "code": "provider-auth-code"},
            )
        self.assertEqual(callback.status_code, 302)
        self.assertEqual(callback.location, "http://localhost:3000/auth/callback")
        self.assertEqual(urlopen.call_count, 2)
        replay = client.get(
            "/auth/oauth/github/callback",
            query_string={"state": state, "code": "replayed-code"},
        )
        self.assertIn("error=state", replay.location)
        self.assertEqual(urlopen.call_count, 2)
        self.assertEqual(client.get("/auth/me").get_json()["providers"], ["github"])
        with self.factory() as session:
            identity = session.scalar(select(OAuthIdentityRecord))
            self.assertEqual(identity.provider, "github")
            self.assertEqual(identity.subject, "98765")
            self.assertIsNone(identity.encrypted_access_token)
            self.assertEqual(identity.provider_username, "developer")

    def test_linked_github_account_can_list_only_public_owned_repositories(self):
        from unittest.mock import Mock

        with self.factory() as session:
            user = UserRecord(email="github-user@example.com", created_at=datetime.now(timezone.utc))
            session.add(user)
            session.flush()
            token = "github-repository-list-session"
            session.add(
                AuthSessionRecord(
                    user_id=user.id,
                    token_digest=hashlib.sha256(token.encode()).hexdigest(),
                    created_at=datetime.now(timezone.utc),
                    expires_at=datetime.now(timezone.utc) + timedelta(days=1),
                )
            )
            session.add(
                OAuthIdentityRecord(
                    user_id=user.id,
                    provider="github",
                    subject="12345",
                    provider_username="developer",
                    created_at=datetime.now(timezone.utc),
                )
            )
            session.commit()

        client = self.app.test_client()
        client.set_cookie("tool_doctor_session", token)
        repos = [
            {
                "id": 1,
                "name": "public-project",
                "full_name": "developer/public-project",
                "private": False,
                "html_url": "https://github.com/developer/public-project",
                "description": "Public project",
                "language": "Python",
                "updated_at": "2026-10-22T12:00:00Z",
                "owner": {"login": "developer"},
            },
            {
                "id": 2,
                "name": "private-project",
                "full_name": "developer/private-project",
                "private": True,
                "html_url": "https://github.com/developer/private-project",
                "owner": {"login": "developer"},
            },
        ]
        response_mock = Mock()
        response_mock.__enter__ = Mock(return_value=response_mock)
        response_mock.__exit__ = Mock(return_value=False)
        response_mock.read.return_value = json.dumps(repos).encode()
        with patch("auth.urllib.request.urlopen", return_value=response_mock) as urlopen:
            response = client.get("/auth/github/repositories")

        self.assertEqual(response.status_code, 200, response.get_json())
        result = response.get_json()
        self.assertEqual(result["visibility"], "public")
        self.assertEqual(len(result["repositories"]), 1)
        self.assertEqual(result["repositories"][0]["fullName"], "developer/public-project")
        requested_url = urlopen.call_args.args[0].full_url
        self.assertIn("/users/developer/repos?", requested_url)
        self.assertNotIn("token", requested_url.lower())

    def test_github_repository_list_requires_linked_provider(self):
        with self.factory() as session:
            user = UserRecord(email="unlinked@example.com", created_at=datetime.now(timezone.utc))
            session.add(user)
            session.flush()
            token = "github-unlinked-session"
            session.add(
                AuthSessionRecord(
                    user_id=user.id,
                    token_digest=hashlib.sha256(token.encode()).hexdigest(),
                    created_at=datetime.now(timezone.utc),
                    expires_at=datetime.now(timezone.utc) + timedelta(days=1),
                )
            )
            session.commit()
        client = self.app.test_client()
        client.set_cookie("tool_doctor_session", token)
        response = client.get("/auth/github/repositories")
        self.assertEqual(response.status_code, 409)

    def test_graphql_repository_data_is_scoped_to_signed_in_user(self):
        with self.factory() as session:
            user_one = UserRecord(email="one@example.com", created_at=datetime.now(timezone.utc))
            user_two = UserRecord(email="two@example.com", created_at=datetime.now(timezone.utc))
            session.add_all([user_one, user_two])
            session.flush()
            user_ids = (user_one.id, user_two.id)
            tokens = ("first-private-test-token", "second-private-test-token")
            for user_id, token in zip(user_ids, tokens):
                session.add(
                    AuthSessionRecord(
                        user_id=user_id,
                        token_digest=hashlib.sha256(token.encode()).hexdigest(),
                        created_at=datetime.now(timezone.utc),
                        expires_at=datetime.now(timezone.utc) + timedelta(days=1),
                    )
                )
            session.commit()

        clients = [self.app.test_client(), self.app.test_client()]
        for client, token in zip(clients, tokens):
            client.set_cookie("tool_doctor_session", token)
        repository = PublicRepository(
            full_name="example/shared",
            name="shared",
            owner="example",
            url="https://github.com/example/shared",
            default_branch="main",
            archived=False,
            pushed_at=None,
            checks=(),
        )
        mutation = """
            mutation { importPublicRepository(fullName: "example/shared") { id repository } }
        """
        with patch("app.GitHubPublicAdapter.import_repository", return_value=repository):
            for client in clients:
                result = client.post("/graphql", json={"query": mutation}).get_json()
                self.assertNotIn("errors", result)

        query = "{ tools { repository provider } }"
        visible = []
        for client in clients:
            result = client.post("/graphql", json={"query": query}).get_json()
            self.assertNotIn("errors", result)
            visible.append(
                {tool["repository"] for tool in result["data"]["tools"] if tool["provider"] == "github"}
            )
        self.assertEqual(visible, [{"example/shared"}, {"example/shared"}])
        with self.factory() as session:
            matching = session.scalars(
                select(ToolRecord).where(ToolRecord.repository == "example/shared")
            ).all()
            self.assertEqual({item.owner_user_id for item in matching}, set(user_ids))
