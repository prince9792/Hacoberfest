import os
import json
import uuid
from datetime import datetime, timedelta, timezone

import redis
import strawberry
from flask import Flask, jsonify, request
from flask_cors import CORS
from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    create_engine,
    delete,
    inspect,
    or_,
    select,
    text,
)
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker
from strawberry.flask.views import GraphQLView

if __package__:
    from .auth import (
        AuthBase,
        AuthSessionRecord,
        bootstrap_admin,
        register_auth_routes,
    )
    from .github_adapter import GitHubPublicAdapter, utc_now
else:
    from auth import AuthBase, AuthSessionRecord, bootstrap_admin, register_auth_routes
    from github_adapter import GitHubPublicAdapter, utc_now


class Base(DeclarativeBase):
    pass


class ToolRecord(Base):
    __tablename__ = "tools"
    __table_args__ = (
        UniqueConstraint("owner_user_id", "repository", name="uq_tool_owner_repository"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    repository: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    health_score: Mapped[int] = mapped_column(Integer, nullable=False)
    summary: Mapped[str] = mapped_column(String(500), nullable=False)
    owner: Mapped[str] = mapped_column(String(120), nullable=False)
    provider: Mapped[str] = mapped_column(String(40), nullable=False, default="sample", server_default="sample")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    next_check_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    monitoring_error: Mapped[str | None] = mapped_column(String(500), nullable=True)
    owner_user_id: Mapped[str | None] = mapped_column(String(36), nullable=True)


class CheckRunRecord(Base):
    __tablename__ = "check_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tool_id: Mapped[str] = mapped_column(ForeignKey("tools.id", ondelete="CASCADE"), nullable=False)
    check_type: Mapped[str] = mapped_column(String(60), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False)
    severity: Mapped[str] = mapped_column(String(30), nullable=False)
    summary: Mapped[str] = mapped_column(String(500), nullable=False)
    evidence: Mapped[str] = mapped_column(Text, nullable=False)
    observed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )


class FindingRecord(Base):
    __tablename__ = "findings"
    __table_args__ = (UniqueConstraint("tool_id", "check_type", name="uq_finding_tool_check_type"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tool_id: Mapped[str] = mapped_column(ForeignKey("tools.id", ondelete="CASCADE"), nullable=False)
    check_type: Mapped[str] = mapped_column(String(60), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="open")
    severity: Mapped[str] = mapped_column(String(30), nullable=False)
    summary: Mapped[str] = mapped_column(String(500), nullable=False)
    evidence: Mapped[str] = mapped_column(Text, nullable=False)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


@strawberry.type
class CheckRun:
    id: strawberry.ID
    check_type: str
    status: str
    severity: str
    summary: str
    evidence: str
    observed_at: datetime


@strawberry.type
class Tool:
    id: strawberry.ID
    name: str
    repository: str
    status: str
    health_score: int
    summary: str
    owner: str
    provider: str
    updated_at: datetime
    last_checked_at: datetime | None
    next_check_at: datetime | None
    monitoring_error: str | None

    @strawberry.field
    def check_runs(self, info: strawberry.Info) -> list[CheckRun]:
        session_factory = info.context["session_factory"]
        with session_factory() as session:
            records = session.scalars(
                select(CheckRunRecord)
                .where(CheckRunRecord.tool_id == str(self.id))
                .order_by(CheckRunRecord.observed_at.desc())
                .limit(12)
            ).all()
            return [
                CheckRun(
                    id=strawberry.ID(record.id),
                    check_type=record.check_type,
                    status=record.status,
                    severity=record.severity,
                    summary=record.summary,
                    evidence=record.evidence,
                    observed_at=record.observed_at,
                )
                for record in records
            ]


@strawberry.type
class Finding:
    id: strawberry.ID
    tool_id: strawberry.ID
    check_type: str
    status: str
    severity: str
    summary: str
    evidence: str
    first_seen_at: datetime
    last_seen_at: datetime
    resolved_at: datetime | None


def to_tool(record: ToolRecord) -> Tool:
    return Tool(
        id=strawberry.ID(record.id),
        name=record.name,
        repository=record.repository,
        status=record.status,
        health_score=record.health_score,
        summary=record.summary,
        owner=record.owner,
        provider=record.provider,
        updated_at=record.updated_at,
        last_checked_at=record.last_checked_at,
        next_check_at=record.next_check_at,
        monitoring_error=record.monitoring_error,
    )


def to_finding(record: FindingRecord) -> Finding:
    return Finding(
        id=strawberry.ID(record.id),
        tool_id=strawberry.ID(record.tool_id),
        check_type=record.check_type,
        status=record.status,
        severity=record.severity,
        summary=record.summary,
        evidence=record.evidence,
        first_seen_at=record.first_seen_at,
        last_seen_at=record.last_seen_at,
        resolved_at=record.resolved_at,
    )


def migrate_repository_ownership(engine) -> None:
    inspector = inspect(engine)
    constraints = inspector.get_unique_constraints("tools")
    if engine.dialect.name == "sqlite":
        with engine.connect() as connection:
            indexes = connection.exec_driver_sql("PRAGMA index_list('tools')").all()
            for index in indexes:
                if index[2]:
                    quoted_name = str(index[1]).replace('"', '""')
                    index_columns = connection.exec_driver_sql(
                        f'PRAGMA index_info("{quoted_name}")'
                    ).all()
                    constraints.append(
                        {"column_names": [column[2] for column in index_columns]}
                    )
    single_repository_constraint = next(
        (item for item in constraints if item["column_names"] == ["repository"]),
        None,
    )
    has_owner_constraint = any(
        set(item["column_names"]) == {"owner_user_id", "repository"}
        for item in constraints
    )
    if single_repository_constraint is None:
        if not has_owner_constraint and engine.dialect.name == "postgresql":
            with engine.begin() as connection:
                connection.execute(
                    text(
                        "ALTER TABLE tools ADD CONSTRAINT uq_tool_owner_repository "
                        "UNIQUE (owner_user_id, repository)"
                    )
                )
        return

    if engine.dialect.name == "sqlite":
        columns = (
            "id, name, repository, status, health_score, summary, owner, provider, "
            "updated_at, last_checked_at, next_check_at, monitoring_error, owner_user_id"
        )
        with engine.connect() as connection:
            connection.exec_driver_sql("PRAGMA foreign_keys=OFF")
            connection.commit()
            with connection.begin():
                connection.exec_driver_sql(
                    "CREATE TABLE tools_new ("
                    "id VARCHAR(36) PRIMARY KEY, name VARCHAR(120) NOT NULL, "
                    "repository VARCHAR(255) NOT NULL, status VARCHAR(20) NOT NULL, "
                    "health_score INTEGER NOT NULL, summary VARCHAR(500) NOT NULL, "
                    "owner VARCHAR(120) NOT NULL, provider VARCHAR(40) NOT NULL DEFAULT 'sample', "
                    "updated_at DATETIME NOT NULL, last_checked_at DATETIME, next_check_at DATETIME, "
                    "monitoring_error VARCHAR(500), owner_user_id VARCHAR(36), "
                    "CONSTRAINT uq_tool_owner_repository UNIQUE (owner_user_id, repository))"
                )
                connection.exec_driver_sql(
                    f"INSERT INTO tools_new ({columns}) SELECT {columns} FROM tools"
                )
                connection.exec_driver_sql("DROP TABLE tools")
                connection.exec_driver_sql("ALTER TABLE tools_new RENAME TO tools")
            connection.exec_driver_sql("PRAGMA foreign_keys=ON")
            connection.commit()
        return

    if engine.dialect.name == "postgresql":
        preparer = engine.dialect.identifier_preparer
        constraint_name = preparer.quote(single_repository_constraint["name"])
        with engine.begin() as connection:
            connection.execute(text(f"ALTER TABLE tools DROP CONSTRAINT {constraint_name}"))
            if not has_owner_constraint:
                connection.execute(
                    text(
                        "ALTER TABLE tools ADD CONSTRAINT uq_tool_owner_repository "
                        "UNIQUE (owner_user_id, repository)"
                    )
                )


def apply_check_results(session, tool: ToolRecord, checks, observed_at: datetime) -> None:
    findings = {
        finding.check_type: finding
        for finding in session.scalars(
            select(FindingRecord).where(FindingRecord.tool_id == tool.id)
        ).all()
    }
    for check in checks:
        finding = findings.get(check.check_type)
        if check.status == "failed":
            if finding is None:
                finding = FindingRecord(
                    tool_id=tool.id,
                    check_type=check.check_type,
                    status="open",
                    severity=check.severity,
                    summary=check.summary,
                    evidence=json.dumps(check.evidence, sort_keys=True),
                    first_seen_at=observed_at,
                    last_seen_at=observed_at,
                )
                session.add(finding)
            else:
                finding.status = "open"
                finding.severity = check.severity
                finding.summary = check.summary
                finding.evidence = json.dumps(check.evidence, sort_keys=True)
                finding.last_seen_at = observed_at
                finding.resolved_at = None
        elif check.status == "passed" and finding is not None and finding.status == "open":
            finding.status = "resolved"
            finding.resolved_at = observed_at


def import_or_refresh_repository(
    session_factory,
    full_name: str,
    monitor_interval_seconds: int,
    allow_create: bool = True,
    owner_user_id: str | None = None,
) -> Tool:
    repository = GitHubPublicAdapter().import_repository(full_name)
    observed_at = utc_now()
    with session_factory() as session:
        record = session.scalar(
            select(ToolRecord).where(
                ToolRecord.repository == repository.full_name,
                ToolRecord.owner_user_id == owner_user_id,
                ToolRecord.provider == "github",
            )
        )
        if record is None and not allow_create:
            raise ValueError("Repository was removed from this workspace before its check finished.")
        if record and record.provider != "github":
            raise ValueError("A sample record already uses this repository name.")
        if record is None:
            record = ToolRecord(
                name=repository.name,
                repository=repository.full_name,
                status="not_checked",
                health_score=0,
                summary="Public metadata observed; no overall health score is configured.",
                owner=repository.owner,
                provider="github",
                owner_user_id=owner_user_id,
            )
            session.add(record)
            session.flush()
        else:
            record.name = repository.name
            record.owner = repository.owner
            record.status = "not_checked"
            record.health_score = 0
            record.summary = "Public metadata observed; no overall health score is configured."
        record.updated_at = observed_at
        record.last_checked_at = observed_at
        record.next_check_at = observed_at + timedelta(seconds=monitor_interval_seconds)
        record.monitoring_error = None

        for check in repository.checks:
            session.add(
                CheckRunRecord(
                    tool_id=record.id,
                    check_type=check.check_type,
                    status=check.status,
                    severity=check.severity,
                    summary=check.summary,
                    evidence=json.dumps(check.evidence, sort_keys=True),
                    observed_at=observed_at,
                )
            )
        apply_check_results(session, record, repository.checks, observed_at)
        session.commit()
        session.refresh(record)
        return to_tool(record)


@strawberry.type
class Query:
    @strawberry.field
    def tools(self, info: strawberry.Info) -> list[Tool]:
        session_factory = info.context["session_factory"]
        with session_factory() as session:
            user_id = info.context.get("user_id")
            statement = select(ToolRecord)
            if user_id:
                statement = statement.where(
                    or_(ToolRecord.provider == "sample", ToolRecord.owner_user_id == user_id)
                )
            records = session.scalars(statement.order_by(ToolRecord.name)).all()
            return [to_tool(record) for record in records]

    @strawberry.field
    def tool(self, info: strawberry.Info, id: strawberry.ID) -> Tool | None:
        session_factory = info.context["session_factory"]
        with session_factory() as session:
            record = session.get(ToolRecord, str(id))
            if (
                record
                and record.provider != "sample"
                and record.owner_user_id != info.context.get("user_id")
            ):
                return None
            return to_tool(record) if record else None

    @strawberry.field
    def findings(self, info: strawberry.Info) -> list[Finding]:
        session_factory = info.context["session_factory"]
        with session_factory() as session:
            statement = select(FindingRecord).join(
                ToolRecord, FindingRecord.tool_id == ToolRecord.id
            )
            user_id = info.context.get("user_id")
            if user_id:
                statement = statement.where(
                    or_(ToolRecord.provider == "sample", ToolRecord.owner_user_id == user_id)
                )
            records = session.scalars(
                statement.order_by(FindingRecord.last_seen_at.desc())
            ).all()
            return [to_finding(record) for record in records]

    @strawberry.field
    def monitor_interval_seconds(self, info: strawberry.Info) -> int:
        return info.context["monitor_interval_seconds"]


@strawberry.type
class Mutation:
    @strawberry.mutation
    def import_public_repository(self, info: strawberry.Info, full_name: str) -> Tool:
        return import_or_refresh_repository(
            info.context["session_factory"],
            full_name,
            info.context["monitor_interval_seconds"],
            owner_user_id=info.context.get("user_id"),
        )

    @strawberry.mutation
    def recheck_public_repository(self, info: strawberry.Info, id: strawberry.ID) -> Tool:
        session_factory = info.context["session_factory"]
        with session_factory() as session:
            record = session.get(ToolRecord, str(id))
            if record is None:
                raise ValueError("Repository was not found in this workspace.")
            if record.provider != "sample" and record.owner_user_id != info.context.get("user_id"):
                raise ValueError("Repository was not found in this workspace.")
            if record.provider != "github":
                raise ValueError("Only imported public GitHub repositories can be rechecked.")
            repository = record.repository
            owner_user_id = record.owner_user_id
        return import_or_refresh_repository(
            session_factory,
            repository,
            info.context["monitor_interval_seconds"],
            allow_create=False,
            owner_user_id=owner_user_id,
        )

    @strawberry.mutation
    def set_finding_status(
        self, info: strawberry.Info, id: strawberry.ID, status: str
    ) -> Finding:
        if status not in {"open", "resolved"}:
            raise ValueError("Finding status must be open or resolved.")
        session_factory = info.context["session_factory"]
        with session_factory() as session:
            record = session.get(FindingRecord, str(id))
            if record is None:
                raise ValueError("Finding was not found.")
            tool = session.get(ToolRecord, record.tool_id)
            if (
                tool is None
                or tool.provider == "sample"
                or tool.owner_user_id != info.context.get("user_id")
            ):
                raise ValueError("Finding was not found.")
            record.status = status
            record.resolved_at = utc_now() if status == "resolved" else None
            session.commit()
            session.refresh(record)
            return to_finding(record)

    @strawberry.mutation
    def remove_public_repository(self, info: strawberry.Info, id: strawberry.ID) -> bool:
        session_factory = info.context["session_factory"]
        with session_factory() as session:
            record = session.get(ToolRecord, str(id))
            if record is None:
                raise ValueError("Repository was not found in this workspace.")
            if record.provider != "github":
                raise ValueError("Sample repositories cannot be removed.")
            if record.owner_user_id != info.context.get("user_id"):
                raise ValueError("Repository was not found in this workspace.")
            session.execute(delete(CheckRunRecord).where(CheckRunRecord.tool_id == record.id))
            session.execute(delete(FindingRecord).where(FindingRecord.tool_id == record.id))
            session.delete(record)
            session.commit()
            return True


schema = strawberry.Schema(query=Query, mutation=Mutation)


def create_app(test_config: dict | None = None) -> Flask:
    app = Flask(__name__)
    config = {
        "DATABASE_URL": os.environ.get(
            "DATABASE_URL",
            "postgresql+psycopg://tooldoctor:tooldoctor@127.0.0.1:15432/tooldoctor",
        ),
        "REDIS_URL": os.environ.get("REDIS_URL", "redis://localhost:6379/0"),
        "WEB_ORIGIN": os.environ.get("WEB_ORIGIN", "http://localhost:3000"),
        "MONITOR_INTERVAL_SECONDS": int(os.environ.get("MONITOR_INTERVAL_SECONDS", "86400")),
        "AUTH_SECRET": os.environ.get("AUTH_SECRET"),
        "AUTH_COOKIE_SECURE": os.environ.get("AUTH_COOKIE_SECURE", "false").lower() == "true",
        "AUTH_COOKIE_SAMESITE": os.environ.get("AUTH_COOKIE_SAMESITE", "Lax"),
        "AUTH_REQUIRED": os.environ.get("AUTH_REQUIRED", "true").lower() == "true",
        "AUTH_ENCRYPTION_KEY": os.environ.get("AUTH_ENCRYPTION_KEY"),
        "PUBLIC_API_URL": os.environ.get("PUBLIC_API_URL", "http://localhost:5000"),
        "SMTP_HOST": os.environ.get("SMTP_HOST"),
        "SMTP_PORT": int(os.environ.get("SMTP_PORT", "587")),
        "SMTP_USERNAME": os.environ.get("SMTP_USERNAME"),
        "SMTP_PASSWORD": os.environ.get("SMTP_PASSWORD"),
        "SMTP_FROM": os.environ.get("SMTP_FROM"),
        "TWILIO_ACCOUNT_SID": os.environ.get("TWILIO_ACCOUNT_SID"),
        "TWILIO_AUTH_TOKEN": os.environ.get("TWILIO_AUTH_TOKEN"),
        "TWILIO_FROM_NUMBER": os.environ.get("TWILIO_FROM_NUMBER"),
        "GITHUB_CLIENT_ID": os.environ.get("GITHUB_CLIENT_ID"),
        "GITHUB_CLIENT_SECRET": os.environ.get("GITHUB_CLIENT_SECRET"),
        "GITLAB_CLIENT_ID": os.environ.get("GITLAB_CLIENT_ID"),
        "GITLAB_CLIENT_SECRET": os.environ.get("GITLAB_CLIENT_SECRET"),
        "ADMIN_EMAIL": os.environ.get("ADMIN_EMAIL"),
        "ADMIN_PASSWORD": os.environ.get("ADMIN_PASSWORD"),
        "ADMIN_NAME": os.environ.get("ADMIN_NAME", "Tool Doctor Admin"),
        "ADMIN_MOBILE": os.environ.get("ADMIN_MOBILE"),
    }
    if test_config:
        config.update(test_config)
    app.config.update(config)
    if app.config["AUTH_COOKIE_SAMESITE"] not in {"Lax", "Strict", "None"}:
        raise ValueError("AUTH_COOKIE_SAMESITE must be Lax, Strict, or None.")
    if app.config["AUTH_COOKIE_SAMESITE"] == "None" and not app.config["AUTH_COOKIE_SECURE"]:
        raise ValueError("AUTH_COOKIE_SECURE must be true when AUTH_COOKIE_SAMESITE is None.")
    if (
        app.config["MONITOR_INTERVAL_SECONDS"] < 3600
        or app.config["MONITOR_INTERVAL_SECONDS"] % 60 != 0
    ):
        raise ValueError("MONITOR_INTERVAL_SECONDS must be at least one hour and a whole number of minutes.")

    engine = create_engine(app.config["DATABASE_URL"], pool_pre_ping=True)
    session_factory = sessionmaker(bind=engine, expire_on_commit=False)
    redis_client = redis.Redis.from_url(app.config["REDIS_URL"], socket_connect_timeout=2)
    app.extensions["tool_doctor_engine"] = engine
    app.extensions["tool_doctor_session_factory"] = session_factory
    app.extensions["tool_doctor_redis"] = redis_client
    CORS(
        app,
        supports_credentials=True,
        resources={
            r"/graphql": {"origins": app.config["WEB_ORIGIN"]},
            r"/auth/.*": {"origins": app.config["WEB_ORIGIN"]},
        },
    )
    register_auth_routes(app, session_factory, app.config)

    @app.before_request
    def require_authentication():
        if request.method == "OPTIONS":
            return None
        if request.path != "/graphql" or not app.config["AUTH_REQUIRED"]:
            return None
        raw_token = request.cookies.get("tool_doctor_session")
        if not raw_token:
            return jsonify({"error": "Sign in to access this workspace."}), 401
        from hashlib import sha256

        with session_factory() as db:
            auth_session = db.scalar(
                select(AuthSessionRecord).where(
                    AuthSessionRecord.token_digest == sha256(raw_token.encode()).hexdigest(),
                    AuthSessionRecord.expires_at > utc_now(),
                )
            )
            if auth_session is None:
                return jsonify({"error": "Your session has expired. Sign in again."}), 401
            user_id = auth_session.user_id
        request.environ["tool_doctor_user_id"] = user_id

    class ToolDoctorGraphQLView(GraphQLView):
        def get_context(self, request, response):
            return {
                "request": request,
                "response": response,
                "session_factory": session_factory,
                "monitor_interval_seconds": app.config["MONITOR_INTERVAL_SECONDS"],
                "user_id": request.environ.get("tool_doctor_user_id"),
            }

    app.add_url_rule(
        "/graphql",
        view_func=ToolDoctorGraphQLView.as_view("graphql", schema=schema),
    )

    @app.get("/healthz")
    def healthz():
        dependencies = {"postgres": "ok", "redis": "ok"}
        try:
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
        except SQLAlchemyError:
            dependencies["postgres"] = "unavailable"
        try:
            redis_client.ping()
        except redis.RedisError:
            dependencies["redis"] = "unavailable"

        healthy = all(status == "ok" for status in dependencies.values())
        return jsonify({"status": "ok" if healthy else "unavailable", "dependencies": dependencies}), (
            200 if healthy else 503
        )

    @app.cli.command("init-db")
    def init_db():
        Base.metadata.create_all(engine)
        AuthBase.metadata.create_all(engine)
        oauth_identity_columns = {
            column["name"] for column in inspect(engine).get_columns("oauth_identities")
        }
        if "provider_username" not in oauth_identity_columns:
            with engine.begin() as connection:
                connection.execute(
                    text("ALTER TABLE oauth_identities ADD COLUMN provider_username VARCHAR(255)")
                )
        user_columns = {column["name"] for column in inspect(engine).get_columns("users")}
        missing_user_columns = {
            "full_name": "VARCHAR(120) NOT NULL DEFAULT ''",
            "organization": "VARCHAR(160)",
            "job_title": "VARCHAR(120)",
            "password_hash": "VARCHAR(255)",
            "role": "VARCHAR(20) NOT NULL DEFAULT 'user'",
        }
        for column_name, column_type in missing_user_columns.items():
            if column_name not in user_columns:
                with engine.begin() as connection:
                    connection.execute(
                        text(f"ALTER TABLE users ADD COLUMN {column_name} {column_type}")
                    )
        otp_columns = {column["name"] for column in inspect(engine).get_columns("otp_challenges")}
        if "requester_digest" not in otp_columns:
            with engine.begin() as connection:
                connection.execute(
                    text("ALTER TABLE otp_challenges ADD COLUMN requester_digest VARCHAR(64) NOT NULL DEFAULT ''")
                )
        tool_columns = {column["name"] for column in inspect(engine).get_columns("tools")}
        timestamp_type = DateTime(timezone=True).compile(dialect=engine.dialect)
        missing_tool_columns = {
            "provider": "VARCHAR(40) NOT NULL DEFAULT 'sample'",
            "last_checked_at": str(timestamp_type),
            "next_check_at": str(timestamp_type),
            "monitoring_error": "VARCHAR(500)",
            "owner_user_id": "VARCHAR(36)",
        }
        for column_name, column_type in missing_tool_columns.items():
            if column_name not in tool_columns:
                with engine.begin() as connection:
                    connection.execute(
                        text(f"ALTER TABLE tools ADD COLUMN {column_name} {column_type}")
                    )
        migrate_repository_ownership(engine)
        bootstrap_admin(session_factory, app.config)
        with session_factory() as session:
            if session.scalar(select(ToolRecord.id).limit(1)) is None:
                session.add_all(
                    [
                        ToolRecord(
                            name="Storefront",
                            repository="acme/storefront",
                            status="healthy",
                            health_score=96,
                            summary="Builds are passing and the latest release is current.",
                            owner="Web team",
                        ),
                        ToolRecord(
                            name="Payments API",
                            repository="acme/payments-api",
                            status="attention",
                            health_score=78,
                            summary="A dependency update is available for review.",
                            owner="Platform team",
                        ),
                        ToolRecord(
                            name="Release Bot",
                            repository="acme/release-bot",
                            status="healthy",
                            health_score=91,
                            summary="Recent checks are passing with no open findings.",
                            owner="Developer experience",
                        ),
                    ]
                )
                session.commit()
        print("Tool Doctor database is ready.")

    return app


app = create_app()
