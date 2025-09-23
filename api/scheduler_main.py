import asyncio
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from dateutil import tz
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models import DeliveryLog, Reminder, User, AlertChannel
from app.ntfy import send_ntfy

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def fire(reminder_id: int) -> None:
    db: Session = SessionLocal()
    try:
        reminder = db.get(Reminder, reminder_id)
        if not reminder or not reminder.enabled:
            logger.info("Skip reminder %s (missing or disabled)", reminder_id)
            return
        
        # Determine which topic to send to: alert channel or user's topic
        topic = None
        if reminder.alert_channel_id:
            alert_channel = db.get(AlertChannel, reminder.alert_channel_id)
            if alert_channel and alert_channel.enabled:
                topic = alert_channel.ntfy_topic
                logger.info("Using alert channel %s for reminder %s", alert_channel.name, reminder_id)
            else:
                logger.warning("Alert channel %s for reminder %s is disabled or missing", reminder.alert_channel_id, reminder_id)
        
        # Fallback to user's topic if no alert channel or alert channel is disabled
        if not topic:
            user: User | None = reminder.user
            if not user:
                logger.warning("Reminder %s missing user and no valid alert channel", reminder_id)
                return
            topic = user.ntfy_topic
            logger.info("Using user topic %s for reminder %s", user.name, reminder_id)
        
        await send_ntfy(topic, reminder.title, reminder.body or "")
        db.add(DeliveryLog(reminder_id=reminder.id, status="sent"))
        db.commit()
        logger.info("Sent reminder %s to topic %s", reminder_id, topic)
    except Exception as exc:  # pragma: no cover - unexpected path
        logger.exception("Failed to send reminder %s: %s", reminder_id, exc)
        db.rollback()
        db.add(DeliveryLog(reminder_id=reminder_id, status="error", detail=str(exc)))
        db.commit()
    finally:
        db.close()


def register_all() -> None:
    db: Session = SessionLocal()
    try:
        scheduler.remove_all_jobs()
        reminders = db.query(Reminder).filter(Reminder.enabled.is_(True)).all()
        for reminder in reminders:
            try:
                user_timezone = tz.gettz(reminder.user.timezone or "America/Vancouver")
                trigger = CronTrigger.from_crontab(reminder.cron, timezone=user_timezone)
                scheduler.add_job(
                    fire,
                    trigger,
                    args=[reminder.id],
                    id=f"rem-{reminder.id}",
                    replace_existing=True,
                )
            except Exception as exc:  # pragma: no cover - scheduling guard
                logger.exception("Failed to schedule reminder %s: %s", reminder.id, exc)
    finally:
        db.close()


async def watcher() -> None:
    while True:
        register_all()
        await asyncio.sleep(10)  # Check every 10 seconds instead of 60


async def main() -> None:
    scheduler.start()
    await watcher()


if __name__ == "__main__":
    asyncio.run(main())
