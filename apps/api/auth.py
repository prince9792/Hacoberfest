import hashlib
import hmac
import json
import os
import re
import secrets
import smtplib
import ssl
import urllib.error
import urllib.parse
import urllib.request
import uuid
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage

from cryptography.fernet import Fernet
from flask import jsonify, make_response, redirect, request
from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, delete, select
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from werkzeug.security import check_password_hash, generate_password_hash


class AuthBase(DeclarativeBase):
    pass


class UserRecord(AuthBase):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    full_name: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    email: Mapped[str | None] = mapped_column(String(320), unique=True, nullable=True)
    phone: Mapped[str | None] = mapped_column(String(32), unique=True, nullable=True)
    organization: Mapped[str | None] = mapped_column(String(160), nullable=True)
    job_title: Mapped[str | None] = mapped_column(String(120), nullable=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="user")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class OtpChallengeRecord(AuthBase):
    __tablename__ = "otp_challenges"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    channel: Mapped[str] = mapped_column(String(10), nullable=False)
    destination: Mapped[str] = mapped_column(String(320), nullable=False)
    requester_digest: Mapped[str] = mapped_column(String(64), nullable=False)
    code_digest: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AuthSessionRecord(AuthBase):
    __tablename__ = "auth_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_digest: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class OAuthStateRecord(AuthBase):
    __tablename__ = "oauth_states"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    state_digest: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    provider: Mapped[str] = mapped_column(String(20), nullable=False)
    intent: Mapped[str] = mapped_column(String(10), nullable=False)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class OAuthIdentityRecord(AuthBase):
    __tablename__ = "oauth_identities"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    provider: Mapped[str] = mapped_column(String(20), nullable=False)
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    provider_username: Mapped[str | None] = mapped_column(String(255), nullable=True)
    encrypted_access_token: Mapped[str | None] = mapped_column(String(4096), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    __table_args__ = (UniqueConstraint("provider", "subject", name="uq_oauth_provider_subject"),)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _digest(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _normalized_destination(channel: str, destination: str) -> str:
    value = destination.strip()
    if channel == "email":
        value = value.lower()
        if len(value) > 320 or value.count("@") != 1 or any(c.isspace() for c in value):
            raise ValueError("Enter a valid email address.")
        local, domain = value.split("@")
        if not local or "." not in domain or domain.startswith(".") or domain.endswith("."):
            raise ValueError("Enter a valid email address.")
    elif channel == "phone":
        if not value.startswith("+") or not value[1:].isdigit() or not 8 <= len(value[1:]) <= 15:
            raise ValueError("Enter a phone number in international format, such as +14155550123.")
    else:
        raise ValueError("Choose email or phone verification.")
    return value


def bootstrap_admin(session_factory, config: dict) -> None:
    email = (config.get("ADMIN_EMAIL") or "").strip().lower()
    password = config.get("ADMIN_PASSWORD") or ""
    if not email and not password:
        return
    if not email or not password:
        raise RuntimeError("Set both ADMIN_EMAIL and ADMIN_PASSWORD to bootstrap the administrator.")
    if len(password) < 12:
        raise RuntimeError("ADMIN_PASSWORD must be at least 12 characters.")
    if len(email) > 320 or email.count("@") != 1:
        raise RuntimeError("ADMIN_EMAIL must be a valid email address.")
    now = _now()
    with session_factory() as db:
        user = db.scalar(select(UserRecord).where(UserRecord.email == email))
        if user is None:
            user = UserRecord(
                full_name=(config.get("ADMIN_NAME") or "Tool Doctor Admin").strip()[:120],
                email=email,
                phone=(config.get("ADMIN_MOBILE") or None),
                organization=None,
                job_title="Administrator",
                password_hash=generate_password_hash(password),
                role="admin",
                created_at=now,
            )
            db.add(user)
        else:
            user.role = "admin"
            user.full_name = (config.get("ADMIN_NAME") or user.full_name or "Tool Doctor Admin").strip()[:120]
            user.job_title = "Administrator"
            user.password_hash = generate_password_hash(password)
        db.commit()


def register_auth_routes(app, session_factory, config: dict) -> None:
    app.config.update(config)

    def secret() -> str:
        value = app.config.get("AUTH_SECRET")
        if not value or len(value) < 32:
            raise RuntimeError("Set AUTH_SECRET to a random value of at least 32 characters.")
        return value

    def current_session():
        token = request.cookies.get("tool_doctor_session")
        if not token:
            return None
        with session_factory() as db:
            record = db.scalar(
                select(AuthSessionRecord).where(
                    AuthSessionRecord.token_digest == _digest(token),
                    AuthSessionRecord.expires_at > _now(),
                )
            )
            return (record.id, record.user_id) if record else None

    @app.get("/auth/github/repositories")
    def github_repositories():
        active = current_session()
        if active is None:
            return jsonify({"error": "Sign in before choosing a GitHub repository."}), 401
        with session_factory() as db:
            identity = db.scalar(
                select(OAuthIdentityRecord).where(
                    OAuthIdentityRecord.user_id == active[1],
                    OAuthIdentityRecord.provider == "github",
                )
            )
            username = identity.provider_username if identity else None
        if not username or not re.fullmatch(r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?", username):
            return jsonify({"error": "Connect your GitHub account before choosing a repository."}), 409

        endpoint = (
            "https://api.github.com/users/"
            + urllib.parse.quote(username, safe="")
            + "/repos?type=owner&sort=updated&per_page=100"
        )
        request_object = urllib.request.Request(
            endpoint,
            headers={
                "Accept": "application/vnd.github+json",
                "User-Agent": "ToolDoctor",
                "X-GitHub-Api-Version": "2022-11-28",
            },
        )
        try:
            with urllib.request.urlopen(request_object, timeout=10) as response:
                payload = json.loads(response.read())
        except urllib.error.HTTPError as error:
            if error.code == 404:
                return jsonify({"error": "The connected GitHub profile could not be found."}), 502
            if error.code == 403:
                return jsonify({"error": "GitHub temporarily rate-limited repository listing. Try again later."}), 503
            app.logger.warning("GitHub repository listing returned HTTP %s", error.code)
            return jsonify({"error": "GitHub could not list repositories right now."}), 502
        except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError):
            app.logger.warning("GitHub repository listing request failed.")
            return jsonify({"error": "Could not reach GitHub. Check your connection and try again."}), 502

        if not isinstance(payload, list):
            return jsonify({"error": "GitHub returned an invalid repository list."}), 502
        repositories = []
        for item in payload:
            if not isinstance(item, dict) or item.get("private") is not False:
                continue
            full_name = item.get("full_name")
            name = item.get("name")
            owner_data = item.get("owner")
            owner_name = owner_data.get("login") if isinstance(owner_data, dict) else None
            url = item.get("html_url")
            parsed_url = urllib.parse.urlsplit(url) if isinstance(url, str) else None
            if (
                not isinstance(full_name, str)
                or not re.fullmatch(r"[A-Za-z0-9_.-]{1,100}/[A-Za-z0-9_.-]{1,100}", full_name)
                or not isinstance(name, str)
                or not isinstance(owner_name, str)
                or owner_name.casefold() != username.casefold()
                or parsed_url is None
                or parsed_url.scheme != "https"
                or parsed_url.hostname != "github.com"
                or parsed_url.path.rstrip("/") != f"/{full_name}"
            ):
                continue
            repositories.append(
                {
                    "fullName": full_name,
                    "name": name,
                    "owner": owner_name,
                    "url": url,
                    "description": item.get("description")
                    if isinstance(item.get("description"), str)
                    else None,
                    "language": item.get("language")
                    if isinstance(item.get("language"), str)
                    else None,
                    "updatedAt": item.get("updated_at")
                    if isinstance(item.get("updated_at"), str)
                    else None,
                }
            )
        return jsonify({"repositories": repositories, "visibility": "public"})

    def set_session(response, user_id: str):
        raw_token = secrets.token_urlsafe(48)
        now = _now()
        with session_factory() as db:
            db.add(
                AuthSessionRecord(
                    user_id=user_id,
                    token_digest=_digest(raw_token),
                    created_at=now,
                    expires_at=now + timedelta(days=30),
                )
            )
            db.commit()
        response.set_cookie(
            "tool_doctor_session",
            raw_token,
            max_age=30 * 24 * 60 * 60,
            httponly=True,
            secure=app.config["AUTH_COOKIE_SECURE"],
            samesite=app.config["AUTH_COOKIE_SAMESITE"],
            path="/",
        )
        return response

    def deliver_otp(channel: str, destination: str, code: str) -> None:
        if channel == "email":
            host = app.config.get("SMTP_HOST")
            sender = app.config.get("SMTP_FROM")
            if not host or not sender:
                raise RuntimeError("Email verification is not configured. Set SMTP_HOST and SMTP_FROM.")
            message = EmailMessage()
            message["Subject"] = "Your Tool Doctor sign-in code"
            message["From"] = sender
            message["To"] = destination
            message.set_content(f"Your Tool Doctor verification code is {code}. It expires in 10 minutes.")
            with smtplib.SMTP(host, int(app.config.get("SMTP_PORT", 587)), timeout=10) as smtp:
                smtp.starttls(context=ssl.create_default_context())
                username = app.config.get("SMTP_USERNAME")
                password = app.config.get("SMTP_PASSWORD")
                if username and password:
                    smtp.login(username, password)
                smtp.send_message(message)
            return

        account_sid = app.config.get("TWILIO_ACCOUNT_SID")
        auth_token = app.config.get("TWILIO_AUTH_TOKEN")
        sender = app.config.get("TWILIO_FROM_NUMBER")
        if not account_sid or not auth_token or not sender:
            raise RuntimeError(
                "Phone verification is not configured. Set TWILIO_ACCOUNT_SID, "
                "TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER."
            )
        endpoint = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
        body = urllib.parse.urlencode(
            {"From": sender, "To": destination, "Body": f"Your Tool Doctor sign-in code is {code}."}
        ).encode("utf-8")
        request_object = urllib.request.Request(endpoint, data=body, method="POST")
        credentials = f"{account_sid}:{auth_token}".encode("utf-8")
        request_object.add_header("Authorization", "Basic " + __import__("base64").b64encode(credentials).decode())
        request_object.add_header("Content-Type", "application/x-www-form-urlencoded")
        try:
            with urllib.request.urlopen(request_object, timeout=10) as response:
                if response.status not in (200, 201):
                    raise RuntimeError("The SMS provider did not accept the verification message.")
        except urllib.error.HTTPError as error:
            raise RuntimeError("The SMS provider could not deliver the verification message.") from error

    @app.get("/auth/me")
    def auth_me():
        active = current_session()
        if active is None:
            return jsonify({"authenticated": False}), 401
        _, user_id = active
        with session_factory() as db:
            user = db.get(UserRecord, user_id)
            if user is None:
                return jsonify({"authenticated": False}), 401
            identities = db.scalars(
                select(OAuthIdentityRecord).where(OAuthIdentityRecord.user_id == user_id)
            ).all()
            return jsonify(
                {
                    "authenticated": True,
                    "user": {
                        "id": user.id,
                        "name": user.full_name,
                        "email": user.email,
                        "phone": user.phone,
                        "organization": user.organization,
                        "jobTitle": user.job_title,
                        "role": user.role,
                    },
                    "providers": sorted({identity.provider for identity in identities}),
                }
            )

    @app.post("/auth/register")
    def register():
        payload = request.get_json(silent=True) or {}
        full_name = str(payload.get("name", "")).strip()
        organization = str(payload.get("organization", "")).strip() or None
        job_title = str(payload.get("jobTitle", "")).strip() or None
        raw_email = str(payload.get("email", ""))
        raw_phone = str(payload.get("mobile", ""))
        password = str(payload.get("password", ""))
        if not 2 <= len(full_name) <= 120:
            return jsonify({"error": "Name must be between 2 and 120 characters."}), 400
        if len(organization or "") > 160 or len(job_title or "") > 120:
            return jsonify({"error": "Organization or job title is too long."}), 400
        if len(password) < 12:
            return jsonify({"error": "Password must be at least 12 characters."}), 400
        try:
            email = _normalized_destination("email", raw_email)
            phone = _normalized_destination("phone", raw_phone)
        except ValueError as error:
            return jsonify({"error": str(error)}), 400

        now = _now()
        with session_factory() as db:
            if db.scalar(select(UserRecord.id).where(UserRecord.email == email)):
                return jsonify({"error": "An account with this email already exists. Sign in instead."}), 409
            if db.scalar(select(UserRecord.id).where(UserRecord.phone == phone)):
                return jsonify({"error": "An account with this mobile number already exists."}), 409
            user = UserRecord(
                full_name=full_name,
                email=email,
                phone=phone,
                organization=organization,
                job_title=job_title,
                password_hash=generate_password_hash(password),
                role="user",
                created_at=now,
            )
            db.add(user)
            db.commit()
            user_id = user.id
        response = make_response(jsonify({"authenticated": True, "role": "user"}), 201)
        return set_session(response, user_id)

    @app.post("/auth/login")
    def login():
        payload = request.get_json(silent=True) or {}
        email = str(payload.get("email", "")).strip().lower()
        password = str(payload.get("password", ""))
        if not email or not password or len(email) > 320:
            return jsonify({"error": "Enter your email address and password."}), 400
        with session_factory() as db:
            user = db.scalar(select(UserRecord).where(UserRecord.email == email))
            if user is None or user.password_hash is None or not check_password_hash(user.password_hash, password):
                return jsonify({"error": "Email or password is incorrect."}), 401
            user_id = user.id
            role = user.role
        response = make_response(jsonify({"authenticated": True, "role": role}))
        return set_session(response, user_id)

    @app.get("/auth/admin/users")
    def admin_users():
        active = current_session()
        if active is None:
            return jsonify({"error": "Sign in to access this workspace."}), 401
        with session_factory() as db:
            current_user = db.get(UserRecord, active[1])
            if current_user is None or current_user.role != "admin":
                return jsonify({"error": "Administrator access is required."}), 403
            users = db.scalars(select(UserRecord).order_by(UserRecord.created_at.desc())).all()
            return jsonify(
                {
                    "users": [
                        {
                            "id": user.id,
                            "name": user.full_name,
                            "email": user.email,
                            "mobile": user.phone,
                            "organization": user.organization,
                            "jobTitle": user.job_title,
                            "role": user.role,
                            "createdAt": user.created_at.isoformat(),
                        }
                        for user in users
                    ]
                }
            )

    @app.post("/auth/logout")
    def auth_logout():
        active = current_session()
        if active is not None:
            with session_factory() as db:
                record = db.get(AuthSessionRecord, active[0])
                if record:
                    db.delete(record)
                    db.commit()
        response = make_response(jsonify({"authenticated": False}))
        response.delete_cookie("tool_doctor_session", path="/")
        return response

    @app.post("/auth/otp/request")
    def request_otp():
        payload = request.get_json(silent=True) or {}
        try:
            channel = payload.get("channel")
            destination = _normalized_destination(channel, str(payload.get("destination", "")))
            signing_secret = secret()
        except (ValueError, RuntimeError) as error:
            return jsonify({"error": str(error)}), 400

        now = _now()
        challenge_id = str(uuid.uuid4())
        code = f"{secrets.randbelow(1_000_000):06d}"
        code_digest = hmac.new(
            signing_secret.encode(), f"{challenge_id}:{code}".encode(), hashlib.sha256
        ).hexdigest()
        remote_address = request.remote_addr or "unknown"
        requester_digest = hmac.new(
            signing_secret.encode(), f"otp-requester:{remote_address}".encode(), hashlib.sha256
        ).hexdigest()
        with session_factory() as db:
            db.execute(
                delete(OtpChallengeRecord).where(
                    OtpChallengeRecord.expires_at < now - timedelta(days=1)
                )
            )
            recent = db.scalar(
                select(OtpChallengeRecord).where(
                    OtpChallengeRecord.requester_digest == requester_digest,
                    OtpChallengeRecord.created_at > now - timedelta(seconds=60),
                )
            )
            if recent:
                return jsonify({"error": "Wait one minute before requesting another code."}), 429
            challenge = OtpChallengeRecord(
                id=challenge_id,
                channel=channel,
                destination=destination,
                requester_digest=requester_digest,
                code_digest=code_digest,
                created_at=now,
                expires_at=now + timedelta(minutes=10),
            )
            db.add(challenge)
            db.commit()
        try:
            deliver_otp(channel, destination, code)
        except (OSError, RuntimeError, smtplib.SMTPException) as error:
            app.logger.warning("OTP delivery failed for %s destination", channel)
            with session_factory() as db:
                challenge = db.get(OtpChallengeRecord, challenge_id)
                if challenge:
                    db.delete(challenge)
                    db.commit()
            return jsonify({"error": str(error)}), 503
        return jsonify({"challengeId": challenge_id, "expiresInSeconds": 600}), 200

    @app.post("/auth/otp/verify")
    def verify_otp():
        payload = request.get_json(silent=True) or {}
        challenge_id = str(payload.get("challengeId", ""))
        code = str(payload.get("code", ""))
        if not code.isdigit() or len(code) != 6:
            return jsonify({"error": "Enter the six-digit verification code."}), 400
        try:
            signing_secret = secret()
        except RuntimeError as error:
            return jsonify({"error": str(error)}), 503
        now = _now()
        with session_factory() as db:
            challenge = db.get(OtpChallengeRecord, challenge_id)
            if challenge is None:
                return jsonify({"error": "This code has expired. Request a new one."}), 400
            expires_at = challenge.expires_at
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if (
                challenge.consumed_at is not None
                or expires_at <= now
                or challenge.attempts >= 5
            ):
                return jsonify({"error": "This code has expired. Request a new one."}), 400
            candidate = hmac.new(
                signing_secret.encode(), f"{challenge.id}:{code}".encode(), hashlib.sha256
            ).hexdigest()
            if not hmac.compare_digest(candidate, challenge.code_digest):
                challenge.attempts += 1
                db.commit()
                return jsonify({"error": "That verification code is incorrect."}), 400
            challenge.consumed_at = now
            column = UserRecord.email if challenge.channel == "email" else UserRecord.phone
            user = db.scalar(select(UserRecord).where(column == challenge.destination))
            if user is None:
                user = UserRecord(
                    email=challenge.destination if challenge.channel == "email" else None,
                    phone=challenge.destination if challenge.channel == "phone" else None,
                    created_at=now,
                )
                db.add(user)
                db.flush()
            user_id = user.id
            db.commit()
        response = make_response(jsonify({"authenticated": True}))
        return set_session(response, user_id)

    oauth_providers = {
        "github": {
            "authorize": "https://github.com/login/oauth/authorize",
            "token": "https://github.com/login/oauth/access_token",
            "profile": "https://api.github.com/user",
            "scope": "read:user user:email",
        },
        "gitlab": {
            "authorize": "https://gitlab.com/oauth/authorize",
            "token": "https://gitlab.com/oauth/token",
            "profile": "https://gitlab.com/api/v4/user",
            "scope": "read_user read_api",
        },
    }

    def oauth_request(url: str, data: dict | None = None, token: str | None = None):
        headers = {"Accept": "application/json", "User-Agent": "ToolDoctor"}
        encoded = None
        if data:
            encoded = urllib.parse.urlencode(data).encode("utf-8")
            headers["Content-Type"] = "application/x-www-form-urlencoded"
        if token:
            headers["Authorization"] = f"Bearer {token}"
        oauth_request_object = urllib.request.Request(url, data=encoded, headers=headers)
        with urllib.request.urlopen(oauth_request_object, timeout=10) as response:
            result = json.loads(response.read())
            if not isinstance(result, dict):
                raise RuntimeError("The identity provider returned an invalid response.")
            return result

    def oauth_client(provider: str):
        prefix = "GITHUB" if provider == "github" else "GITLAB"
        client_id = app.config.get(f"{prefix}_CLIENT_ID")
        client_secret = app.config.get(f"{prefix}_CLIENT_SECRET")
        if not client_id or not client_secret:
            raise RuntimeError(f"{provider.title()} sign-in is not configured on this server.")
        return prefix, client_id, client_secret

    def callback_url(provider: str) -> str:
        return f"{app.config['PUBLIC_API_URL'].rstrip('/')}/auth/oauth/{provider}/callback"

    @app.get("/auth/oauth/<provider>/start")
    def oauth_start(provider: str):
        if provider not in oauth_providers:
            return jsonify({"error": "That sign-in provider is not supported."}), 404
        try:
            _, client_id, _ = oauth_client(provider)
        except RuntimeError as error:
            return jsonify({"error": str(error)}), 503
        intent = request.args.get("intent", "login")
        active = current_session()
        user_id = None
        if intent == "connect":
            if active is None:
                return jsonify({"error": "Sign in before connecting a provider."}), 401
            user_id = active[1]
        elif intent != "login":
            return jsonify({"error": "Invalid sign-in intent."}), 400
        state = secrets.token_urlsafe(32)
        now = _now()
        with session_factory() as db:
            db.add(
                OAuthStateRecord(
                    state_digest=_digest(state),
                    provider=provider,
                    intent=intent,
                    user_id=user_id,
                    created_at=now,
                    expires_at=now + timedelta(minutes=10),
                )
            )
            db.commit()
        query = urllib.parse.urlencode(
            {
                "client_id": client_id,
                "redirect_uri": callback_url(provider),
                "response_type": "code",
                "scope": oauth_providers[provider]["scope"],
                "state": state,
            }
        )
        return redirect(f"{oauth_providers[provider]['authorize']}?{query}")

    @app.get("/auth/oauth/<provider>/callback")
    def oauth_callback(provider: str):
        frontend = app.config["WEB_ORIGIN"].rstrip("/")
        if provider not in oauth_providers:
            return redirect(f"{frontend}/login?error=provider")
        state = request.args.get("state", "")
        code = request.args.get("code", "")
        if not state or not code or request.args.get("error"):
            return redirect(f"{frontend}/login?error=cancelled")
        now = _now()
        with session_factory() as db:
            oauth_state = db.scalar(
                select(OAuthStateRecord).where(
                    OAuthStateRecord.state_digest == _digest(state),
                    OAuthStateRecord.provider == provider,
                    OAuthStateRecord.consumed_at.is_(None),
                    OAuthStateRecord.expires_at > now,
                )
            )
            if oauth_state is None:
                return redirect(f"{frontend}/login?error=state")
            oauth_state.consumed_at = now
            intent = oauth_state.intent
            linked_user_id = oauth_state.user_id
            db.commit()
        try:
            _, client_id, client_secret = oauth_client(provider)
            token_parameters = {
                "client_id": client_id,
                "client_secret": client_secret,
                "code": code,
                "redirect_uri": callback_url(provider),
            }
            if provider == "gitlab":
                token_parameters.update(
                    {"grant_type": "authorization_code", "state": state}
                )
            token_response = oauth_request(
                oauth_providers[provider]["token"],
                token_parameters,
            )
            access_token = token_response.get("access_token")
            subject_data = oauth_request(
                oauth_providers[provider]["profile"], token=str(access_token)
            )
            subject = str(subject_data.get("id", ""))
            provider_username = subject_data.get("login") if provider == "github" else subject_data.get("username")
            if (
                not access_token
                or not subject
                or (
                    provider == "github"
                    and (
                        not isinstance(provider_username, str)
                        or not re.fullmatch(
                            r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?",
                            provider_username,
                        )
                    )
                )
            ):
                raise RuntimeError("The identity provider did not return a valid account.")
            encryption_key = app.config.get("AUTH_ENCRYPTION_KEY")
            if provider == "gitlab" and not encryption_key:
                raise RuntimeError("Set AUTH_ENCRYPTION_KEY to enable GitLab account connections.")
            encrypted = (
                Fernet(encryption_key.encode()).encrypt(str(access_token).encode()).decode()
                if provider == "gitlab"
                else None
            )
            with session_factory() as db:
                identity = db.scalar(
                    select(OAuthIdentityRecord).where(
                        OAuthIdentityRecord.provider == provider,
                        OAuthIdentityRecord.subject == subject,
                    )
                )
                if intent == "connect":
                    user = db.get(UserRecord, linked_user_id) if linked_user_id else None
                    if user is None:
                        raise RuntimeError("Your session expired. Sign in and connect the provider again.")
                    if identity and identity.user_id != user.id:
                        raise RuntimeError("That provider account is already linked to another Tool Doctor account.")
                elif identity:
                    user = db.get(UserRecord, identity.user_id)
                else:
                    email = subject_data.get("email")
                    user = UserRecord(
                        email=str(email).lower() if email and provider == "gitlab" else None,
                        phone=None,
                        created_at=now,
                    )
                    if user.email and db.scalar(
                        select(UserRecord.id).where(UserRecord.email == user.email)
                    ):
                        raise RuntimeError(
                            "This email belongs to another account. Sign in with OTP first, then connect this provider."
                        )
                    db.add(user)
                    db.flush()
                if identity is None:
                    db.add(
                        OAuthIdentityRecord(
                            user_id=user.id,
                            provider=provider,
                            subject=subject,
                            provider_username=provider_username,
                            encrypted_access_token=encrypted,
                            created_at=now,
                        )
                    )
                else:
                    identity.provider_username = provider_username
                    if encrypted:
                        identity.encrypted_access_token = encrypted
                db.commit()
                user_id = user.id
        except (RuntimeError, ValueError, KeyError, urllib.error.URLError, OSError) as error:
            app.logger.warning("%s OAuth callback failed: %s", provider, error)
            return redirect(f"{frontend}/login?error=oauth")
        destination = (
            f"{frontend}/dashboard?section=integrations"
            if intent == "connect"
            else f"{frontend}/auth/callback"
        )
        response = make_response(redirect(destination))
        return set_session(response, user_id)
