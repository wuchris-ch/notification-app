# Refactor Plan: Channels-Only Design

## Overview
Remove the `User` model entirely and use only `Channel` for all notification destinations. Reminders can send to multiple channels.

## New Data Model

### Channel Model (replaces both User and AlertChannel)
```python
class Channel(Base):
    __tablename__ = "channels"
    
    id = Column(Integer, primary_key=True)
    name = Column(String(64), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    ntfy_topic = Column(String(128), nullable=False, unique=True)
    timezone = Column(String(64), default="America/Vancouver")
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
```

**Examples:**
- "Chris" → `family-chris`, timezone: America/Vancouver
- "Mom" → `family-mom`, timezone: America/Vancouver  
- "Dad" → `family-dad`, timezone: America/Vancouver
- "Family Group" → `family-all`, timezone: America/Vancouver

### ReminderChannel (Many-to-Many relationship)
```python
class ReminderChannel(Base):
    __tablename__ = "reminder_channels"
    
    id = Column(Integer, primary_key=True)
    reminder_id = Column(Integer, ForeignKey("reminders.id"), nullable=False)
    channel_id = Column(Integer, ForeignKey("channels.id"), nullable=False)
```

### Reminder Model (updated)
```python
class Reminder(Base):
    __tablename__ = "reminders"
    
    id = Column(Integer, primary_key=True)
    title = Column(String(120), nullable=False)
    body = Column(Text, nullable=True)
    cron = Column(String(64), nullable=False)
    timezone = Column(String(64), default="America/Vancouver")  # NEW: reminder has its own timezone
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Many-to-many relationship with channels
    channels = relationship("Channel", secondary="reminder_channels", backref="reminders")
```

### DeliveryLog (updated)
```python
class DeliveryLog(Base):
    __tablename__ = "delivery_logs"
    
    id = Column(Integer, primary_key=True)
    reminder_id = Column(Integer, ForeignKey("reminders.id"), nullable=False)
    channel_id = Column(Integer, ForeignKey("channels.id"), nullable=True)  # NEW: track which channel
    sent_at = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(String(32), default="sent")
    detail = Column(Text, nullable=True)
```

## Key Changes

### 1. Timezone Handling
**Current:** Reminder uses user's timezone
**New:** Reminder has its own timezone field (defaults to America/Vancouver)

This makes sense because:
- A reminder is scheduled at a specific time
- That time should be consistent regardless of who receives it
- Example: "Family dinner at 6 PM Pacific" should fire at 6 PM Pacific for everyone

### 2. Notification Delivery
**Current:** Send to either user's topic OR alert channel's topic
**New:** Send to ALL selected channels

```python
async def fire(reminder_id: int) -> None:
    reminder = db.get(Reminder, reminder_id)
    
    # Send to all channels
    for channel in reminder.channels:
        if channel.enabled:
            await send_ntfy(channel.ntfy_topic, reminder.title, reminder.body or "")
            db.add(DeliveryLog(
                reminder_id=reminder.id,
                channel_id=channel.id,
                status="sent"
            ))
```

### 3. Scheduling
**Current:** Uses user's timezone from relationship
**New:** Uses reminder's own timezone

```python
def register_all() -> None:
    reminders = db.query(Reminder).filter(Reminder.enabled.is_(True)).all()
    for reminder in reminders:
        reminder_timezone = tz.gettz(reminder.timezone or "America/Vancouver")
        trigger = CronTrigger.from_crontab(reminder.cron, timezone=reminder_timezone)
        scheduler.add_job(fire, trigger, args=[reminder.id], id=f"rem-{reminder.id}")
```

## API Changes

### Channels API (replaces both /users and /alert-channels)

```python
# GET /api/channels - List all channels
# POST /api/channels - Create new channel
{
    "name": "Chris",
    "description": "Chris's personal notifications",
    "ntfy_topic": "family-chris",
    "timezone": "America/Vancouver"
}

# GET /api/channels/{id} - Get channel
# PUT /api/channels/{id} - Update channel
# DELETE /api/channels/{id} - Delete channel
```

### Reminders API (updated)

```python
# POST /api/reminders - Create reminder
{
    "title": "Take medication",
    "body": "Don't forget your vitamins",
    "cron": "0 8 * * *",
    "timezone": "America/Vancouver",
    "channel_ids": [1, 2, 4]  # NEW: array of channel IDs
}

# PUT /api/reminders/{id} - Update reminder
{
    "title": "Updated title",
    "channel_ids": [1, 3]  # Can change which channels receive it
}
```

### Test Notification API (updated)

```python
# POST /api/test-notification
{
    "channel_id": 1,  # Changed from user_id
    "title": "Test",
    "body": "Testing notifications"
}
```

## Migration Strategy

### Step 1: Create new tables
```sql
-- Create channels table
CREATE TABLE channels (
    id INTEGER PRIMARY KEY,
    name VARCHAR(64) UNIQUE NOT NULL,
    description TEXT,
    ntfy_topic VARCHAR(128) UNIQUE NOT NULL,
    timezone VARCHAR(64) DEFAULT 'America/Vancouver',
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create reminder_channels junction table
CREATE TABLE reminder_channels (
    id INTEGER PRIMARY KEY,
    reminder_id INTEGER NOT NULL REFERENCES reminders(id) ON DELETE CASCADE,
    channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    UNIQUE(reminder_id, channel_id)
);
```

### Step 2: Migrate existing data
```sql
-- Migrate users to channels
INSERT INTO channels (name, description, ntfy_topic, timezone, enabled)
SELECT 
    name,
    'Personal notifications for ' || name,
    ntfy_topic,
    timezone,
    TRUE
FROM users;

-- Migrate alert_channels to channels
INSERT INTO channels (name, description, ntfy_topic, timezone, enabled)
SELECT 
    name,
    description,
    ntfy_topic,
    'America/Vancouver',  -- Default timezone
    enabled
FROM alert_channels;

-- Migrate reminder relationships
-- For reminders with alert_channel_id, use that channel
INSERT INTO reminder_channels (reminder_id, channel_id)
SELECT 
    r.id,
    c.id
FROM reminders r
JOIN alert_channels ac ON r.alert_channel_id = ac.id
JOIN channels c ON c.ntfy_topic = ac.ntfy_topic;

-- For reminders without alert_channel_id, use user's channel
INSERT INTO reminder_channels (reminder_id, channel_id)
SELECT 
    r.id,
    c.id
FROM reminders r
JOIN users u ON r.user_id = u.id
JOIN channels c ON c.ntfy_topic = u.ntfy_topic
WHERE r.alert_channel_id IS NULL;

-- Add timezone to reminders from their user
ALTER TABLE reminders ADD COLUMN timezone VARCHAR(64) DEFAULT 'America/Vancouver';
UPDATE reminders r
SET timezone = u.timezone
FROM users u
WHERE r.user_id = u.id;
```

### Step 3: Drop old tables
```sql
-- Drop old foreign keys and columns
ALTER TABLE reminders DROP COLUMN user_id;
ALTER TABLE reminders DROP COLUMN alert_channel_id;

-- Drop old tables
DROP TABLE users;
DROP TABLE alert_channels;
```

## Frontend Changes

### 1. Navigation
**Remove:** "Manage Users" link
**Keep:** "Alert Channels" → rename to "Channels"

### 2. Channels Page (replaces both users and alert-channels)
- Single page to manage all channels
- Create/edit/delete channels
- Each channel has: name, description, ntfy_topic, timezone

### 3. Create Reminder Page
**Before:**
- Select user (required)
- Select alert channel (optional)

**After:**
- Select one or more channels (required)
- Select timezone (required, defaults to America/Vancouver)

**UI Example:**
```
Title: [Take medication]
Body: [Don't forget vitamins]
Schedule: [Daily at 8:00 AM]
Timezone: [America/Vancouver ▼]

Send to channels:
☑ Chris
☑ Mom
☐ Dad
☐ Family Group

[Create Reminder]
```

### 4. Reminders List
Show which channels each reminder sends to:
```
"Take medication"
Daily at 8:00 AM (Pacific)
→ Chris, Mom
```

## Benefits of This Design

1. **Simpler:** One concept (Channel) instead of two (User + AlertChannel)
2. **Flexible:** Send to any combination of channels
3. **Clear:** "Channel" = notification destination
4. **Scalable:** Easy to add new channels without creating "users"
5. **No Redundancy:** No confusion about user topics vs channel topics

## Example Use Cases

### Personal Reminder
```
Title: "Take blood pressure medication"
Channels: [Chris]
→ Sends to family-chris only
```

### Family Reminder
```
Title: "Family dinner tonight"
Channels: [Chris, Mom, Dad]
→ Sends to family-chris, family-mom, family-dad
```

### Broadcast Reminder
```
Title: "Weekly family meeting"
Channels: [Family Group]
→ Sends to family-all (everyone subscribes to this)
```

### Selective Reminder
```
Title: "Parents' anniversary dinner"
Channels: [Mom, Dad]
→ Sends to family-mom, family-dad only
```

## Implementation Order

1. **Database Migration**
   - Create new tables
   - Migrate data
   - Drop old tables

2. **Backend API**
   - Update models.py
   - Update schemas.py
   - Update main.py endpoints
   - Update scheduler_main.py
   - Update AI service

3. **Frontend**
   - Update API client (lib/api.ts)
   - Create new Channels page
   - Update Reminders page
   - Update Dashboard page
   - Remove Users page
   - Update Navigation

4. **Testing**
   - Test channel CRUD
   - Test reminder creation with multiple channels
   - Test notification delivery
   - Test timezone handling

## Questions to Resolve

1. **Default Channels:** Should we auto-create some default channels on first run?
   - Suggestion: Create "Family Group" → `family-all` by default

2. **Timezone per Reminder:** Is this the right approach, or should channels have timezones?
   - Current plan: Reminder has timezone (makes sense for "when" it fires)
   - Alternative: Use first selected channel's timezone

3. **AI Integration:** How should AI handle multiple channels?
   - Suggestion: AI can suggest channels based on natural language
   - Example: "Remind mom and dad..." → selects Mom and Dad channels