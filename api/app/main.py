from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session
from croniter import croniter
import pytz

from .db import Base, SessionLocal, engine
from .models import Reminder, User, DeliveryLog, AlertChannel, Channel, ReminderChannel
from .ntfy import send_ntfy
from .schemas import (
    ReminderIn, ReminderOut, ReminderUpdate, TestNotificationIn,
    UserIn, UserOut, UserUpdate, DeliveryLogOut,
    AlertChannelIn, AlertChannelOut, AlertChannelUpdate,
    AIReminderIn, AIReminderOut,
    ChannelIn, ChannelOut, ChannelUpdate,
    LegacyReminderIn, LegacyReminderOut, LegacyReminderUpdate
)
from .ai_service import parse_natural_language_reminder, validate_and_enhance_reminder

app = FastAPI(title="Family Reminders API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.on_event("startup")
def startup() -> None:
    Base.metadata.create_all(bind=engine)


@app.get("/health")
def health(db: Session = Depends(get_db)):
    db.execute(text("select 1"))

# ============================================================================
# NEW: Channels CRUD endpoints (replaces both /users and /alert-channels)
# ============================================================================

@app.post("/api/channels", response_model=ChannelOut)
def create_channel(channel: ChannelIn, db: Session = Depends(get_db)):
    """Create a new channel"""
    # Check if name already exists
    if db.query(Channel).filter(Channel.name == channel.name).first():
        raise HTTPException(400, "Channel with this name already exists")
    
    # Check if ntfy_topic already exists
    if db.query(Channel).filter(Channel.ntfy_topic == channel.ntfy_topic).first():
        raise HTTPException(400, "Channel with this ntfy_topic already exists")
    
    # Validate timezone
    if channel.timezone and channel.timezone not in pytz.all_timezones:
        raise HTTPException(422, "Invalid timezone")
    
    db_channel = Channel(**channel.model_dump())
    db.add(db_channel)
    db.commit()
    db.refresh(db_channel)
    return ChannelOut.model_validate(db_channel)


@app.get("/api/channels", response_model=list[ChannelOut])
def list_channels(db: Session = Depends(get_db)):
    """List all channels"""
    channels = db.query(Channel).order_by(Channel.name).all()
    return [ChannelOut.model_validate(channel) for channel in channels]


@app.get("/api/channels/{channel_id}", response_model=ChannelOut)
def get_channel(channel_id: int, db: Session = Depends(get_db)):
    """Get a specific channel"""
    channel = db.get(Channel, channel_id)
    if not channel:
        raise HTTPException(404, "Channel not found")
    return ChannelOut.model_validate(channel)


@app.put("/api/channels/{channel_id}", response_model=ChannelOut)
def update_channel(channel_id: int, channel: ChannelUpdate, db: Session = Depends(get_db)):
    """Update a channel"""
    db_channel = db.get(Channel, channel_id)
    if not db_channel:
        raise HTTPException(404, "Channel not found")
    
    update_data = channel.model_dump(exclude_unset=True)
    
    # Check for duplicate name
    if "name" in update_data:
        existing = db.query(Channel).filter(
            Channel.name == update_data["name"],
            Channel.id != channel_id
        ).first()
        if existing:
            raise HTTPException(400, "Channel with this name already exists")
    
    # Check for duplicate ntfy_topic
    if "ntfy_topic" in update_data:
        existing = db.query(Channel).filter(
            Channel.ntfy_topic == update_data["ntfy_topic"],
            Channel.id != channel_id
        ).first()
        if existing:
            raise HTTPException(400, "Channel with this ntfy_topic already exists")
    
    # Validate timezone
    if "timezone" in update_data and update_data["timezone"] not in pytz.all_timezones:
        raise HTTPException(422, "Invalid timezone")
    
    for field, value in update_data.items():
        setattr(db_channel, field, value)
    
    db.commit()
    db.refresh(db_channel)
    return ChannelOut.model_validate(db_channel)


@app.delete("/api/channels/{channel_id}")
def delete_channel(channel_id: int, db: Session = Depends(get_db)):
    """Delete a channel"""
    channel = db.get(Channel, channel_id)
    if not channel:
        raise HTTPException(404, "Channel not found")
    
    # Check if any reminders are using this channel
    reminder_count = db.query(ReminderChannel).filter(
        ReminderChannel.channel_id == channel_id
    ).count()
    if reminder_count > 0:
        raise HTTPException(
            400, 
            f"Cannot delete channel: {reminder_count} reminders are still using it"
        )
    
    db.delete(channel)
    db.commit()
    return {"detail": "Channel deleted successfully"}

    return {"ok": True}


# Users CRUD endpoints
@app.post("/users", response_model=UserOut)
def create_user(u: UserIn, db: Session = Depends(get_db)):
    if db.query(User).filter(User.name == u.name).first():
        raise HTTPException(400, "name taken")
    
    if u.timezone and u.timezone not in pytz.all_timezones:
        raise HTTPException(422, "Invalid timezone")
    
    user = User(name=u.name, ntfy_topic=u.ntfy_topic, timezone=u.timezone)
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)


@app.get("/users", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db)):
    users = db.query(User).order_by(User.name).all()
    return [UserOut.model_validate(user) for user in users]


@app.get("/users/{user_id}", response_model=UserOut)
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    return UserOut.model_validate(user)


@app.put("/users/{user_id}", response_model=UserOut)
def update_user(user_id: int, u: UserUpdate, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    
    update_data = u.model_dump(exclude_unset=True)
    
    if "name" in update_data:
        existing_user = db.query(User).filter(
            User.name == update_data["name"], 
            User.id != user_id
        ).first()
        if existing_user:
            raise HTTPException(400, "User with this name already exists")
    
    if "timezone" in update_data and update_data["timezone"] not in pytz.all_timezones:
        raise HTTPException(422, "Invalid timezone")
    
    for field, value in update_data.items():
        setattr(user, field, value)
    
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)


@app.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    
    # Delete associated reminders and logs
    reminders = db.query(Reminder).filter(Reminder.user_id == user_id).all()
    for reminder in reminders:
        db.query(DeliveryLog).filter(DeliveryLog.reminder_id == reminder.id).delete()
    db.query(Reminder).filter(Reminder.user_id == user_id).delete()
    
    db.delete(user)
    db.commit()
    return {"detail": "User deleted successfully"}


# ============================================================================
# NEW: Reminders CRUD endpoints (updated for channels)
# ============================================================================

@app.post("/api/reminders", response_model=ReminderOut)
def create_reminder(r: ReminderIn, db: Session = Depends(get_db)):
    """Create a new reminder with multiple channels"""
    # Validate channel_ids
    if not r.channel_ids or len(r.channel_ids) == 0:
        raise HTTPException(400, "At least one channel is required")
    
    # Verify all channels exist
    for channel_id in r.channel_ids:
        if not db.get(Channel, channel_id):
            raise HTTPException(404, f"Channel {channel_id} not found")
    
    # Validate cron expression
    try:
        croniter(r.cron)
    except ValueError:
        raise HTTPException(422, "Invalid cron expression")
    
    # Validate timezone
    if r.timezone and r.timezone not in pytz.all_timezones:
        raise HTTPException(422, "Invalid timezone")
    
    # Create reminder (without channel_ids field)
    reminder_data = r.model_dump(exclude={'channel_ids'})
    reminder = Reminder(**reminder_data)
    db.add(reminder)
    db.flush()  # Get the reminder ID
    
    # Create reminder-channel associations
    for channel_id in r.channel_ids:
        reminder_channel = ReminderChannel(
            reminder_id=reminder.id,
            channel_id=channel_id
        )
        db.add(reminder_channel)
    
    db.commit()
    db.refresh(reminder)
    return ReminderOut.model_validate(reminder)


@app.get("/api/reminders", response_model=list[ReminderOut])
def list_reminders(channel_id: int | None = None, db: Session = Depends(get_db)):
    """List all reminders, optionally filtered by channel"""
    query = db.query(Reminder)
    
    if channel_id:
        # Filter by channel using the junction table
        query = query.join(ReminderChannel).filter(
            ReminderChannel.channel_id == channel_id
        )
    
    reminders = query.order_by(Reminder.id.desc()).all()
    return [ReminderOut.model_validate(rem) for rem in reminders]


@app.get("/api/reminders/{reminder_id}", response_model=ReminderOut)
def get_reminder(reminder_id: int, db: Session = Depends(get_db)):
    """Get a specific reminder"""
    reminder = db.get(Reminder, reminder_id)
    if not reminder:
        raise HTTPException(404, "Reminder not found")
    return ReminderOut.model_validate(reminder)


@app.put("/api/reminders/{reminder_id}", response_model=ReminderOut)
def update_reminder(reminder_id: int, r: ReminderUpdate, db: Session = Depends(get_db)):
    """Update a reminder"""
    reminder = db.get(Reminder, reminder_id)
    if not reminder:
        raise HTTPException(404, "Reminder not found")
    
    update_data = r.model_dump(exclude_unset=True)
    
    # Handle channel_ids update separately
    if "channel_ids" in update_data:
        channel_ids = update_data.pop("channel_ids")
        
        # Validate all channels exist
        for channel_id in channel_ids:
            if not db.get(Channel, channel_id):
                raise HTTPException(404, f"Channel {channel_id} not found")
        
        # Remove old associations
        db.query(ReminderChannel).filter(
            ReminderChannel.reminder_id == reminder_id
        ).delete()
        
        # Create new associations
        for channel_id in channel_ids:
            reminder_channel = ReminderChannel(
                reminder_id=reminder_id,
                channel_id=channel_id
            )
            db.add(reminder_channel)
    
    # Validate cron if provided
    if "cron" in update_data:
        try:
            croniter(update_data["cron"])
        except ValueError:
            raise HTTPException(422, "Invalid cron expression")
    
    # Validate timezone if provided
    if "timezone" in update_data and update_data["timezone"] not in pytz.all_timezones:
        raise HTTPException(422, "Invalid timezone")
    
    # Update other fields
    for field, value in update_data.items():
        setattr(reminder, field, value)
    
    db.commit()
    db.refresh(reminder)
    return ReminderOut.model_validate(reminder)


@app.delete("/api/reminders/{reminder_id}")
def delete_reminder(reminder_id: int, db: Session = Depends(get_db)):
    """Delete a reminder"""
    reminder = db.get(Reminder, reminder_id)
    if not reminder:
        raise HTTPException(404, "Reminder not found")
    
    # Delete associated reminder-channel relationships (cascade should handle this)
    db.query(ReminderChannel).filter(
        ReminderChannel.reminder_id == reminder_id
    ).delete()
    
    # Delete associated delivery logs
    db.query(DeliveryLog).filter(DeliveryLog.reminder_id == reminder_id).delete()
    
    db.delete(reminder)
    db.commit()
    return {"detail": "Reminder deleted successfully"}


# ============================================================================
# OLD: Legacy Reminders endpoints (deprecated, kept for backward compatibility)
# ============================================================================

@app.post("/reminders", response_model=LegacyReminderOut, deprecated=True)
def create_reminder_legacy(r: LegacyReminderIn, db: Session = Depends(get_db)):
    """DEPRECATED: Use POST /api/reminders instead"""
    if not db.get(User, r.user_id):
        raise HTTPException(404, "user not found")
    
    if r.alert_channel_id and not db.get(AlertChannel, r.alert_channel_id):
        raise HTTPException(404, "alert channel not found")
    
    try:
        croniter(r.cron)
    except ValueError:
        raise HTTPException(422, "Invalid cron expression")
    
    rem = Reminder(**r.model_dump())
    db.add(rem)
    db.commit()
    db.refresh(rem)
    return LegacyReminderOut.model_validate(rem)


@app.get("/reminders", response_model=list[LegacyReminderOut], deprecated=True)
def list_reminders_legacy(user_id: int | None = None, db: Session = Depends(get_db)):
    """DEPRECATED: Use GET /api/reminders instead"""
    query = db.query(Reminder)
    if user_id:
        query = query.filter(Reminder.user_id == user_id)
    reminders = query.order_by(Reminder.id.desc()).all()
    return [LegacyReminderOut.model_validate(rem) for rem in reminders]


@app.get("/reminders/{reminder_id}", response_model=LegacyReminderOut, deprecated=True)
def get_reminder_legacy(reminder_id: int, db: Session = Depends(get_db)):
    """DEPRECATED: Use GET /api/reminders/{reminder_id} instead"""
    reminder = db.get(Reminder, reminder_id)
    if not reminder:
        raise HTTPException(404, "Reminder not found")
    return LegacyReminderOut.model_validate(reminder)


@app.put("/reminders/{reminder_id}", response_model=LegacyReminderOut, deprecated=True)
def update_reminder_legacy(reminder_id: int, r: LegacyReminderUpdate, db: Session = Depends(get_db)):
    """DEPRECATED: Use PUT /api/reminders/{reminder_id} instead"""
    reminder = db.get(Reminder, reminder_id)
    if not reminder:
        raise HTTPException(404, "Reminder not found")
    
    update_data = r.model_dump(exclude_unset=True)
    
    if "user_id" in update_data and not db.get(User, update_data["user_id"]):
        raise HTTPException(404, "User not found")
    
    if "alert_channel_id" in update_data and update_data["alert_channel_id"] and not db.get(AlertChannel, update_data["alert_channel_id"]):
        raise HTTPException(404, "Alert channel not found")
    
    if "cron" in update_data:
        try:
            croniter(update_data["cron"])
        except ValueError:
            raise HTTPException(422, "Invalid cron expression")
    
    for field, value in update_data.items():
        setattr(reminder, field, value)
    
    db.commit()
    db.refresh(reminder)
    return LegacyReminderOut.model_validate(reminder)


@app.delete("/reminders/{reminder_id}", deprecated=True)
def delete_reminder_legacy(reminder_id: int, db: Session = Depends(get_db)):
    """DEPRECATED: Use DELETE /api/reminders/{reminder_id} instead"""
    reminder = db.get(Reminder, reminder_id)
    if not reminder:
        raise HTTPException(404, "Reminder not found")
    
    # Delete associated delivery logs
    db.query(DeliveryLog).filter(DeliveryLog.reminder_id == reminder_id).delete()
    db.delete(reminder)
    db.commit()
    return {"detail": "Reminder deleted successfully"}


# Alert Channels CRUD endpoints
@app.post("/alert-channels", response_model=AlertChannelOut)
def create_alert_channel(channel: AlertChannelIn, db: Session = Depends(get_db)):
    existing_channel = db.query(AlertChannel).filter(AlertChannel.name == channel.name).first()
    if existing_channel:
        raise HTTPException(400, "Alert channel with this name already exists")
    
    db_channel = AlertChannel(
        name=channel.name,
        description=channel.description,
        ntfy_topic=channel.ntfy_topic,
        enabled=True
    )
    db.add(db_channel)
    db.commit()
    db.refresh(db_channel)
    return AlertChannelOut.model_validate(db_channel)


@app.get("/alert-channels", response_model=list[AlertChannelOut])
def list_alert_channels(db: Session = Depends(get_db)):
    channels = db.query(AlertChannel).order_by(AlertChannel.name).all()
    return [AlertChannelOut.model_validate(channel) for channel in channels]


@app.get("/alert-channels/{channel_id}", response_model=AlertChannelOut)
def get_alert_channel(channel_id: int, db: Session = Depends(get_db)):
    channel = db.get(AlertChannel, channel_id)
    if not channel:
        raise HTTPException(404, "Alert channel not found")
    return AlertChannelOut.model_validate(channel)


@app.put("/alert-channels/{channel_id}", response_model=AlertChannelOut)
def update_alert_channel(channel_id: int, channel: AlertChannelUpdate, db: Session = Depends(get_db)):
    db_channel = db.get(AlertChannel, channel_id)
    if not db_channel:
        raise HTTPException(404, "Alert channel not found")
    
    update_data = channel.model_dump(exclude_unset=True)
    
    if "name" in update_data:
        existing_channel = db.query(AlertChannel).filter(
            AlertChannel.name == update_data["name"], 
            AlertChannel.id != channel_id
        ).first()
        if existing_channel:
            raise HTTPException(400, "Alert channel with this name already exists")
    
    for field, value in update_data.items():
        setattr(db_channel, field, value)
    
    db.commit()
    db.refresh(db_channel)
    return AlertChannelOut.model_validate(db_channel)


@app.delete("/alert-channels/{channel_id}")
def delete_alert_channel(channel_id: int, db: Session = Depends(get_db)):
    channel = db.get(AlertChannel, channel_id)
    if not channel:
        raise HTTPException(404, "Alert channel not found")
    
    # Check if any reminders are using this channel
    reminders_using_channel = db.query(Reminder).filter(Reminder.alert_channel_id == channel_id).count()
    if reminders_using_channel > 0:
        raise HTTPException(400, f"Cannot delete alert channel: {reminders_using_channel} reminders are still using it")
    
    db.delete(channel)
    db.commit()
    return {"detail": "Alert channel deleted successfully"}


# Delivery logs endpoint
@app.get("/logs", response_model=list[DeliveryLogOut])
def list_delivery_logs(reminder_id: int | None = None, limit: int = 50, db: Session = Depends(get_db)):
    query = db.query(DeliveryLog)
    if reminder_id:
        query = query.filter(DeliveryLog.reminder_id == reminder_id)
    logs = query.order_by(DeliveryLog.sent_at.desc()).limit(limit).all()
    return [DeliveryLogOut.model_validate(log) for log in logs]


# ============================================================================
# NEW: Test notification endpoint (updated for channels)
# ============================================================================

@app.post("/api/notifications/test")
async def send_test_notification(payload: TestNotificationIn, db: Session = Depends(get_db)):
    """Send a test notification to a channel"""
    channel = db.get(Channel, payload.channel_id)
    if not channel:
        raise HTTPException(404, "Channel not found")
    
    if not channel.enabled:
        raise HTTPException(400, "Channel is disabled")
    
    await send_ntfy(channel.ntfy_topic, payload.title, payload.body or "")
    return {"ok": True}


# OLD: Legacy test notification endpoint (deprecated)
@app.post("/notifications/test", deprecated=True)
async def send_test_notification_legacy(payload: TestNotificationIn, db: Session = Depends(get_db)):
    """DEPRECATED: Use POST /api/notifications/test instead"""
    # For backward compatibility, treat channel_id as user_id
    user = db.get(User, payload.channel_id)
    if not user:
        raise HTTPException(404, "user not found")
    await send_ntfy(user.ntfy_topic, payload.title, payload.body or "")
    return {"ok": True}


# ============================================================================
# NEW: AI-powered reminder endpoints (updated for channels)
# ============================================================================

@app.post("/api/reminders/ai/parse", response_model=AIReminderOut)
async def parse_ai_reminder(payload: AIReminderIn, db: Session = Depends(get_db)):
    """
    Parse natural language input into structured reminder data using AI.
    This endpoint only parses and returns the structured data without creating the reminder.
    """
    # Validate channel_ids
    if not payload.channel_ids or len(payload.channel_ids) == 0:
        raise HTTPException(400, "At least one channel is required")
    
    # Verify all channels exist and get the first channel's timezone as default
    first_channel = None
    for channel_id in payload.channel_ids:
        channel = db.get(Channel, channel_id)
        if not channel:
            raise HTTPException(404, f"Channel {channel_id} not found")
        if first_channel is None:
            first_channel = channel
    
    try:
        # Parse the natural language input using the first channel's timezone
        parsed_data = parse_natural_language_reminder(
            payload.natural_language,
            first_channel.timezone
        )
        
        # Validate and enhance the parsed data
        enhanced_data = validate_and_enhance_reminder(parsed_data)
        
        return AIReminderOut(**enhanced_data)
        
    except ValueError as e:
        raise HTTPException(422, f"Failed to parse reminder: {str(e)}")
    except Exception as e:
        raise HTTPException(500, f"AI processing error: {str(e)}")


@app.post("/api/reminders/ai/create", response_model=ReminderOut)
async def create_ai_reminder(payload: AIReminderIn, db: Session = Depends(get_db)):
    """
    Parse natural language input and create a reminder in one step.
    """
    # Validate channel_ids
    if not payload.channel_ids or len(payload.channel_ids) == 0:
        raise HTTPException(400, "At least one channel is required")
    
    # Verify all channels exist and get the first channel's timezone as default
    first_channel = None
    for channel_id in payload.channel_ids:
        channel = db.get(Channel, channel_id)
        if not channel:
            raise HTTPException(404, f"Channel {channel_id} not found")
        if first_channel is None:
            first_channel = channel
    
    try:
        # Parse the natural language input using the first channel's timezone
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"🔍 DEBUG - Input: '{payload.natural_language}'")
        logger.info(f"🔍 DEBUG - Using timezone: {first_channel.timezone}")
        
        parsed_data = parse_natural_language_reminder(
            payload.natural_language,
            first_channel.timezone
        )
        
        logger.info(f"🔍 DEBUG - Parsed cron from AI: {parsed_data.get('cron')}")
        
        # Validate and enhance the parsed data
        enhanced_data = validate_and_enhance_reminder(parsed_data)
        
        logger.info(f"🔍 DEBUG - Enhanced cron: {enhanced_data.get('cron')}")
        
        # Create the reminder with channels
        reminder_data = ReminderIn(
            channel_ids=payload.channel_ids,
            title=enhanced_data["title"],
            body=enhanced_data.get("body"),
            cron=enhanced_data["cron"],
            timezone=enhanced_data.get("timezone", first_channel.timezone)
        )
        
        logger.info(f"🔍 DEBUG - Final cron before DB: {reminder_data.cron}")
        
        # Validate cron expression (already done in validate_and_enhance_reminder, but double-check)
        try:
            croniter(reminder_data.cron)
        except ValueError:
            raise HTTPException(422, "Invalid cron expression generated by AI")
        
        # Create reminder (without channel_ids field)
        reminder_dict = reminder_data.model_dump(exclude={'channel_ids'})
        reminder = Reminder(**reminder_dict)
        db.add(reminder)
        db.flush()  # Get the reminder ID
        
        # Create reminder-channel associations
        for channel_id in payload.channel_ids:
            reminder_channel = ReminderChannel(
                reminder_id=reminder.id,
                channel_id=channel_id
            )
            db.add(reminder_channel)
        
        db.commit()
        db.refresh(reminder)
        
        return ReminderOut.model_validate(reminder)
        
    except ValueError as e:
        raise HTTPException(422, f"Failed to parse reminder: {str(e)}")
    except Exception as e:
        raise HTTPException(500, f"AI processing error: {str(e)}")


# ============================================================================
# OLD: Legacy AI reminder endpoints (deprecated)
# ============================================================================

@app.post("/reminders/ai/parse", response_model=AIReminderOut, deprecated=True)
async def parse_ai_reminder_legacy(payload: AIReminderIn, db: Session = Depends(get_db)):
    """DEPRECATED: Use POST /api/reminders/ai/parse instead"""
    # For backward compatibility, use channel_ids as if they were user_id
    if not payload.channel_ids or len(payload.channel_ids) == 0:
        raise HTTPException(400, "At least one channel is required")
    
    # Get first channel and use its timezone
    channel = db.get(Channel, payload.channel_ids[0])
    if not channel:
        raise HTTPException(404, "Channel not found")
    
    try:
        parsed_data = parse_natural_language_reminder(
            payload.natural_language,
            channel.timezone
        )
        enhanced_data = validate_and_enhance_reminder(parsed_data)
        return AIReminderOut(**enhanced_data)
    except ValueError as e:
        raise HTTPException(422, f"Failed to parse reminder: {str(e)}")
    except Exception as e:
        raise HTTPException(500, f"AI processing error: {str(e)}")


@app.post("/reminders/ai/create", response_model=ReminderOut, deprecated=True)
async def create_ai_reminder_legacy(payload: AIReminderIn, db: Session = Depends(get_db)):
    """DEPRECATED: Use POST /api/reminders/ai/create instead"""
    # Redirect to new endpoint
    return await create_ai_reminder(payload, db)
