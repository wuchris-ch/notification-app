from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session
from croniter import croniter
import pytz

from .db import Base, SessionLocal, engine
from .models import Reminder, User, DeliveryLog, AlertChannel
from .ntfy import send_ntfy
from .schemas import (
    ReminderIn, ReminderOut, ReminderUpdate, TestNotificationIn, 
    UserIn, UserOut, UserUpdate, DeliveryLogOut,
    AlertChannelIn, AlertChannelOut, AlertChannelUpdate
)

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


# Reminders CRUD endpoints
@app.post("/reminders", response_model=ReminderOut)
def create_reminder(r: ReminderIn, db: Session = Depends(get_db)):
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
    return ReminderOut.model_validate(rem)


@app.get("/reminders", response_model=list[ReminderOut])
def list_reminders(user_id: int | None = None, db: Session = Depends(get_db)):
    query = db.query(Reminder)
    if user_id:
        query = query.filter(Reminder.user_id == user_id)
    reminders = query.order_by(Reminder.id.desc()).all()
    return [ReminderOut.model_validate(rem) for rem in reminders]


@app.get("/reminders/{reminder_id}", response_model=ReminderOut)
def get_reminder(reminder_id: int, db: Session = Depends(get_db)):
    reminder = db.get(Reminder, reminder_id)
    if not reminder:
        raise HTTPException(404, "Reminder not found")
    return ReminderOut.model_validate(reminder)


@app.put("/reminders/{reminder_id}", response_model=ReminderOut)
def update_reminder(reminder_id: int, r: ReminderUpdate, db: Session = Depends(get_db)):
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
    return ReminderOut.model_validate(reminder)


@app.delete("/reminders/{reminder_id}")
def delete_reminder(reminder_id: int, db: Session = Depends(get_db)):
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


@app.post("/notifications/test")
async def send_test_notification(payload: TestNotificationIn, db: Session = Depends(get_db)):
    user = db.get(User, payload.user_id)
    if not user:
        raise HTTPException(404, "user not found")
    await send_ntfy(user.ntfy_topic, payload.title, payload.body or "")
    return {"ok": True}
