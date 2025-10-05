from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional


# NEW: Channel schemas (replaces User and AlertChannel)
class ChannelIn(BaseModel):
    name: str
    description: Optional[str] = None
    ntfy_topic: str
    timezone: str = "America/Vancouver"


class ChannelOut(ChannelIn):
    id: int
    enabled: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ChannelUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    ntfy_topic: Optional[str] = None
    timezone: Optional[str] = None
    enabled: Optional[bool] = None


# NEW: Updated Reminder schemas with channel_ids and timezone
class ReminderIn(BaseModel):
    channel_ids: list[int]  # NEW: Array of channel IDs
    title: str
    body: str | None = None
    cron: str
    timezone: str = "America/Vancouver"  # NEW: Reminder has its own timezone


class ChannelInfo(BaseModel):
    """Minimal channel info for reminder output"""
    id: int
    name: str
    ntfy_topic: str
    model_config = ConfigDict(from_attributes=True)


class ReminderOut(BaseModel):
    id: int
    title: str
    body: str | None
    cron: str
    timezone: str
    enabled: bool
    created_at: datetime
    channels: list[ChannelInfo]  # NEW: Include channel information
    model_config = ConfigDict(from_attributes=True)


class ReminderUpdate(BaseModel):
    channel_ids: Optional[list[int]] = None  # NEW: Can update which channels receive it
    title: Optional[str] = None
    body: Optional[str] = None
    cron: Optional[str] = None
    timezone: Optional[str] = None
    enabled: Optional[bool] = None


# UPDATED: DeliveryLog with channel_id
class DeliveryLogOut(BaseModel):
    id: int
    reminder_id: int
    channel_id: Optional[int] = None  # NEW: Track which channel
    sent_at: datetime
    status: str
    detail: str
    model_config = ConfigDict(from_attributes=True)


# UPDATED: Test notification with channel_id
class TestNotificationIn(BaseModel):
    channel_id: int  # Changed from user_id
    title: str
    body: str | None = None


# NEW: AI Reminder schemas with channel_ids
class AIReminderIn(BaseModel):
    channel_ids: list[int]  # Changed from user_id/alert_channel_id
    natural_language: str


class AIReminderOut(BaseModel):
    title: str
    body: Optional[str]
    cron: str
    timezone: str
    schedule_description: str
    confidence: str
    next_execution: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


# OLD: Keep old schemas temporarily for backward compatibility
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


# OLD: Legacy reminder schemas (deprecated)
class LegacyReminderIn(BaseModel):
    user_id: int
    alert_channel_id: Optional[int] = None
    title: str
    body: str | None = None
    cron: str


class LegacyReminderOut(LegacyReminderIn):
    id: int
    enabled: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class LegacyReminderUpdate(BaseModel):
    user_id: Optional[int] = None
    alert_channel_id: Optional[int] = None
    title: Optional[str] = None
    body: Optional[str] = None
    cron: Optional[str] = None
    enabled: Optional[bool] = None
