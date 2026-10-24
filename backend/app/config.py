import os
from collections.abc import Mapping


def _boolean(value: str, name: str) -> bool:
    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    raise ValueError(f"{name} must be a boolean value.")


def _integer(value: str, name: str) -> int:
    try:
        return int(value)
    except ValueError as exc:
        raise ValueError(f"{name} must be an integer.") from exc


def load_settings(source: Mapping[str, str] | None = None) -> dict[str, object]:
    env = os.environ if source is None else source

    def value(name: str, default: str = "") -> str:
        return env.get(name, default)

    return {
        "SECRET_KEY": value("AUTH_SECRET"),
        "AUTH_SECRET": value("AUTH_SECRET"),
        "AUTH_ENCRYPTION_KEY": value("AUTH_ENCRYPTION_KEY"),
        "AUTH_REQUIRED": _boolean(value("AUTH_REQUIRED", "true"), "AUTH_REQUIRED"),
        "AUTH_COOKIE_SECURE": _boolean(
            value("AUTH_COOKIE_SECURE", "false"), "AUTH_COOKIE_SECURE"
        ),
        "AUTH_COOKIE_SAMESITE": value("AUTH_COOKIE_SAMESITE", "Lax"),
        "DATABASE_URL": value("DATABASE_URL"),
        "REDIS_URL": value("REDIS_URL"),
        "WEB_ORIGIN": value("WEB_ORIGIN", "http://localhost:3000"),
        "PUBLIC_API_URL": value("PUBLIC_API_URL", "http://localhost:5000"),
        "MONITOR_INTERVAL_SECONDS": _integer(
            value("MONITOR_INTERVAL_SECONDS", "86400"),
            "MONITOR_INTERVAL_SECONDS",
        ),
        "GITHUB_API_TOKEN": value("GITHUB_API_TOKEN"),
        "GITHUB_CLIENT_ID": value("GITHUB_CLIENT_ID"),
        "GITHUB_CLIENT_SECRET": value("GITHUB_CLIENT_SECRET"),
        "GITLAB_BASE_URL": value("GITLAB_BASE_URL", "https://gitlab.com"),
        "GITLAB_CLIENT_ID": value("GITLAB_CLIENT_ID"),
        "GITLAB_CLIENT_SECRET": value("GITLAB_CLIENT_SECRET"),
        "SMTP_HOST": value("SMTP_HOST"),
        "SMTP_PORT": _integer(value("SMTP_PORT", "587"), "SMTP_PORT"),
        "SMTP_USERNAME": value("SMTP_USERNAME"),
        "SMTP_PASSWORD": value("SMTP_PASSWORD"),
        "SMTP_FROM": value("SMTP_FROM"),
        "TWILIO_ACCOUNT_SID": value("TWILIO_ACCOUNT_SID"),
        "TWILIO_AUTH_TOKEN": value("TWILIO_AUTH_TOKEN"),
        "TWILIO_FROM_NUMBER": value("TWILIO_FROM_NUMBER"),
        "ADMIN_EMAIL": value("ADMIN_EMAIL"),
        "ADMIN_PASSWORD": value("ADMIN_PASSWORD"),
        "ADMIN_NAME": value("ADMIN_NAME", "Tool Doctor Admin"),
        "ADMIN_MOBILE": value("ADMIN_MOBILE"),
    }
