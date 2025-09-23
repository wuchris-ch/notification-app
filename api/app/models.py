from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Text, DateTime, func
from sqlalchemy.orm import relationship

from .db import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    name = Column(String(64), unique=True, nullable=False)
    ntfy_topic = Column(String(128), nullable=False)
    timezone = Column(String(64), default="America/Vancouver")
    pin_hash = Column(String(128), nullable=True)

    reminders = relationship("Reminder", back_populates="user", cascade="all, delete-orphan")


class AlertChannel(Base):
    __tablename__ = "alert_channels"

    id = Column(Integer, primary_key=True)
    name = Column(String(64), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    ntfy_topic = Column(String(128), nullable=False)
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    reminders = relationship("Reminder", back_populates="alert_channel")


class Reminder(Base):
    __tablename__ = "reminders"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    alert_channel_id = Column(Integer, ForeignKey("alert_channels.id"), nullable=True)
    title = Column(String(120), nullable=False)
    body = Column(Text, nullable=True)
    cron = Column(String(64), nullable=False)
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="reminders")
    alert_channel = relationship("AlertChannel", back_populates="reminders")


class DeliveryLog(Base):
    __tablename__ = "delivery_logs"

    id = Column(Integer, primary_key=True)
    reminder_id = Column(Integer, ForeignKey("reminders.id"), nullable=False)
    sent_at = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(String(32), default="sent")
    detail = Column(Text, nullable=True)
