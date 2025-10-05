import asyncio
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from dateutil import tz
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models import DeliveryLog, Reminder
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
        
        # Check if reminder has any channels
        if not reminder.channels:
            logger.warning("Reminder %s has no channels configured, skipping", reminder_id)
            return
        
        # Check if all channels are disabled
        enabled_channels = [ch for ch in reminder.channels if ch.enabled]
        if not enabled_channels:
            logger.warning("Reminder %s has no enabled channels, skipping", reminder_id)
            return
        
        # Send to ALL enabled channels
        sent_count = 0
        for channel in enabled_channels:
            try:
                await send_ntfy(channel.ntfy_topic, reminder.title, reminder.body or "")
                db.add(DeliveryLog(
                    reminder_id=reminder.id,
                    channel_id=channel.id,
                    status="sent"
                ))
                logger.info("Sent reminder %s to channel %s (topic: %s)",
                           reminder_id, channel.name, channel.ntfy_topic)
                sent_count += 1
            except Exception as exc:
                logger.exception("Failed to send reminder %s to channel %s: %s",
                               reminder_id, channel.name, exc)
                db.add(DeliveryLog(
                    reminder_id=reminder_id,
                    channel_id=channel.id,
                    status="error",
                    detail=str(exc)
                ))
        
        db.commit()
        logger.info("Sent reminder %s to %d/%d enabled channels",
                   reminder_id, sent_count, len(enabled_channels))
    except Exception as exc:  # pragma: no cover - unexpected path
        logger.exception("Failed to process reminder %s: %s", reminder_id, exc)
        db.rollback()
    finally:
        db.close()


def register_all() -> None:
    db: Session = SessionLocal()
    try:
        scheduler.remove_all_jobs()
        reminders = db.query(Reminder).filter(Reminder.enabled.is_(True)).all()
        for reminder in reminders:
            try:
                # Use reminder's own timezone instead of user's timezone
                reminder_timezone = tz.gettz(reminder.timezone or "America/Vancouver")
                trigger = CronTrigger.from_crontab(reminder.cron, timezone=reminder_timezone)
                scheduler.add_job(
                    fire,
                    trigger,
                    args=[reminder.id],
                    id=f"rem-{reminder.id}",
                    replace_existing=True,
                )
                logger.info("Scheduled reminder %s with timezone %s",
                           reminder.id, reminder.timezone or "America/Vancouver")
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
