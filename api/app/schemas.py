from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional


class UserIn(BaseModel):
    name: str
    ntfy_topic: str
    timezone: str = "America/Vancouver"


class UserOut(UserIn):
    id: int
    model_config = ConfigDict(from_attributes=True)


class UserUpdate(BaseModel):
    name: Optional[str] = None
    ntfy_topic: Optional[str] = None
    timezone: Optional[str] = None


class AlertChannelIn(BaseModel):
    name: str
    description: Optional[str] = None
    ntfy_topic: str


class AlertChannelOut(AlertChannelIn):
    id: int
    enabled: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class AlertChannelUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    ntfy_topic: Optional[str] = None
    enabled: Optional[bool] = None


class ReminderIn(BaseModel):
    user_id: int
    alert_channel_id: Optional[int] = None
    title: str
    body: str | None = None
    cron: str


class ReminderOut(ReminderIn):
    id: int
    enabled: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ReminderUpdate(BaseModel):
    user_id: Optional[int] = None
    alert_channel_id: Optional[int] = None
    title: Optional[str] = None
    body: Optional[str] = None
    cron: Optional[str] = None
    enabled: Optional[bool] = None


class DeliveryLogOut(BaseModel):
    id: int
    reminder_id: int
    sent_at: datetime
    status: str
    detail: str
    model_config = ConfigDict(from_attributes=True)


class TestNotificationIn(BaseModel):
    user_id: int
    title: str
    body: str | None = None


class AIReminderIn(BaseModel):
    user_id: int
    alert_channel_id: Optional[int] = None
    natural_language: str


class AIReminderOut(BaseModel):
    title: str
    body: Optional[str]
    cron: str
    schedule_description: str
    confidence: str
    next_execution: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)
