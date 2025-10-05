from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Text, DateTime, func
from sqlalchemy.orm import relationship

from .db import Base


# NEW: Channel model (replaces both User and AlertChannel)
class Channel(Base):
    __tablename__ = "channels"
    
    id = Column(Integer, primary_key=True)
    name = Column(String(64), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    ntfy_topic = Column(String(128), nullable=False, unique=True)
    timezone = Column(String(64), default="America/Vancouver")
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Many-to-many relationship with reminders
    reminders = relationship("Reminder", secondary="reminder_channels", back_populates="channels")


# NEW: ReminderChannel junction table for many-to-many relationship
class ReminderChannel(Base):
    __tablename__ = "reminder_channels"
    
    id = Column(Integer, primary_key=True)
    reminder_id = Column(Integer, ForeignKey("reminders.id", ondelete="CASCADE"), nullable=False)
    channel_id = Column(Integer, ForeignKey("channels.id", ondelete="CASCADE"), nullable=False)


# OLD: Keep User model temporarily for migration compatibility
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    name = Column(String(64), unique=True, nullable=False)
    ntfy_topic = Column(String(128), nullable=False)
    timezone = Column(String(64), default="America/Vancouver")
    pin_hash = Column(String(128), nullable=True)

    reminders = relationship("Reminder", back_populates="user", cascade="all, delete-orphan")


# OLD: Keep AlertChannel model temporarily for migration compatibility
class AlertChannel(Base):
    __tablename__ = "alert_channels"

    id = Column(Integer, primary_key=True)
    name = Column(String(64), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    ntfy_topic = Column(String(128), nullable=False)
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    reminders = relationship("Reminder", back_populates="alert_channel")


# UPDATED: Reminder model with timezone field and many-to-many channels
class Reminder(Base):
    __tablename__ = "reminders"

    id = Column(Integer, primary_key=True)
    # OLD: Keep these temporarily for migration compatibility
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    alert_channel_id = Column(Integer, ForeignKey("alert_channels.id"), nullable=True)
    
    title = Column(String(120), nullable=False)
    body = Column(Text, nullable=True)
    cron = Column(String(64), nullable=False)
    # NEW: Reminder has its own timezone
    timezone = Column(String(64), default="America/Vancouver")
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # OLD: Keep these temporarily for migration compatibility
    user = relationship("User", back_populates="reminders")
    alert_channel = relationship("AlertChannel", back_populates="reminders")
    
    # NEW: Many-to-many relationship with channels
    channels = relationship("Channel", secondary="reminder_channels", back_populates="reminders")


# UPDATED: DeliveryLog with channel_id field
class DeliveryLog(Base):
    __tablename__ = "delivery_logs"

    id = Column(Integer, primary_key=True)
    reminder_id = Column(Integer, ForeignKey("reminders.id"), nullable=False)
    # NEW: Track which channel received the notification
    channel_id = Column(Integer, ForeignKey("channels.id"), nullable=True)
    sent_at = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(String(32), default="sent")
    detail = Column(Text, nullable=True)
