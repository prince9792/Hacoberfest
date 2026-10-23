import logging
import os
import time
from datetime import timedelta

from sqlalchemy import select

from app import ToolRecord, app, import_or_refresh_repository, utc_now


logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("tool-doctor.monitor")


def run_due_checks() -> int:
    session_factory = app.extensions["tool_doctor_session_factory"]
    interval_seconds = app.config["MONITOR_INTERVAL_SECONDS"]
    now = utc_now()
    with session_factory() as session:
        due_repositories = session.execute(
            select(ToolRecord.id, ToolRecord.repository, ToolRecord.owner_user_id).where(
                ToolRecord.provider == "github",
                ToolRecord.next_check_at.is_not(None),
                ToolRecord.next_check_at <= now,
            )
        ).all()

    for tool_id, repository, owner_user_id in due_repositories:
        try:
            import_or_refresh_repository(
                session_factory,
                repository,
                interval_seconds,
                allow_create=False,
                owner_user_id=owner_user_id,
            )
            logger.info("Updated scheduled checks for %s", repository)
        except Exception as error:
            logger.exception("Scheduled check failed for %s", repository)
            with session_factory() as session:
                record = session.get(ToolRecord, tool_id)
                if record is not None:
                    record.monitoring_error = str(error)[:500]
                    record.next_check_at = utc_now() + timedelta(seconds=interval_seconds)
                    session.commit()
    return len(due_repositories)


def main() -> None:
    poll_interval_seconds = int(os.environ.get("MONITOR_POLL_SECONDS", "60"))
    if poll_interval_seconds < 5:
        raise ValueError("MONITOR_POLL_SECONDS must be at least 5.")
    logger.info(
        "Repository monitor started; checking due repositories every %s seconds",
        poll_interval_seconds,
    )
    while True:
        run_due_checks()
        time.sleep(poll_interval_seconds)


if __name__ == "__main__":
    main()
