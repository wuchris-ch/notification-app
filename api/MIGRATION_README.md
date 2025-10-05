# Database Migration Guide: Channel-Only Model

This guide explains how to migrate your ntfy-family database from the old User/AlertChannel dual-model design to the new unified Channel-only model.

## Overview

The migration script (`migrate_to_channels.py`) automates the process of:
1. Creating new Channel and ReminderChannel tables
2. Migrating User records → Channel records
3. Migrating AlertChannel records → Channel records
4. Creating many-to-many reminder-channel relationships
5. Adding timezone field to reminders
6. Optionally cleaning up old tables

## Prerequisites

### 1. Backup Your Database

**CRITICAL: Always backup your database before running any migration!**

```bash
# For PostgreSQL
pg_dump -U your_user -d ntfy_family > backup_$(date +%Y%m%d_%H%M%S).sql

# Or using Docker
docker exec ntfy-family-db pg_dump -U postgres ntfy_family > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2. Stop Running Services

Stop the API and scheduler to prevent conflicts:

```bash
# If using docker-compose
docker-compose down

# Or stop individual services
./stop.sh
```

### 3. Verify Database Connection

Ensure your `.env` file has the correct `DATABASE_URL`:

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/ntfy_family
```

## Migration Steps

### Step 1: Dry Run (Recommended)

Always run a dry run first to preview what changes will be made:

```bash
cd api
python migrate_to_channels.py --dry-run
```

This will:
- Show you exactly what will be migrated
- Display statistics about your data
- Not make any actual changes to the database

Review the output carefully!

### Step 2: Run the Migration

If the dry run looks good, run the actual migration:

```bash
python migrate_to_channels.py
```

You will be prompted to confirm before any changes are made.

### Step 3: Verify the Migration

After migration completes, verify the data:

```bash
# Connect to your database
psql -U your_user -d ntfy_family

# Check channels were created
SELECT id, name, ntfy_topic, timezone FROM channels;

# Check reminder-channel relationships
SELECT r.title, c.name 
FROM reminders r
JOIN reminder_channels rc ON r.id = rc.reminder_id
JOIN channels c ON rc.channel_id = c.id;

# Check reminders have timezones
SELECT id, title, timezone FROM reminders;
```

## Migration Options

### Keep Old Tables

If you want to keep the old User and AlertChannel tables for reference:

```bash
python migrate_to_channels.py --skip-cleanup
```

This allows you to verify the migration before removing old data.

### Full Migration with Cleanup

To run the complete migration and remove old tables:

```bash
python migrate_to_channels.py --cleanup
```

Or simply:

```bash
python migrate_to_channels.py
```

(Cleanup is the default behavior, but you'll be prompted to confirm)

## What Gets Migrated

### Users → Channels

Each user becomes a channel:

```
User:
  name: "Chris"
  ntfy_topic: "family-chris"
  timezone: "America/Vancouver"

→ Channel:
  name: "Chris"
  description: "Personal notifications for Chris"
  ntfy_topic: "family-chris"
  timezone: "America/Vancouver"
```

### AlertChannels → Channels

Each alert channel becomes a channel:

```
AlertChannel:
  name: "Family Group"
  description: "All family members"
  ntfy_topic: "family-all"
  enabled: true

→ Channel:
  name: "Family Group"
  description: "All family members"
  ntfy_topic: "family-all"
  timezone: "America/Vancouver"  # Default
  enabled: true
```

### Reminder Relationships

Reminders are linked to channels based on their old relationships:

```
Reminder with alert_channel_id:
  → Links to that alert channel's new channel

Reminder with user_id (no alert_channel_id):
  → Links to that user's new channel
```

### Reminder Timezones

Each reminder gets a timezone field populated from its user:

```
Reminder:
  user_id: 1 (Chris, timezone: "America/Vancouver")
  
→ Reminder:
  timezone: "America/Vancouver"
  channels: [Chris's channel]
```

## Migration Log

The script creates a detailed log file:

```
migration_YYYYMMDD_HHMMSS.log
```

This log contains:
- All migration steps
- Any warnings or errors
- Statistics about migrated data

Keep this log for your records!

## Troubleshooting

### Error: "Channel already exists"

This means a channel with the same `ntfy_topic` already exists. The script will:
- Use the existing channel instead of creating a duplicate
- Log a warning
- Continue with the migration

### Error: "Could not find channel for reminder"

This means a reminder has neither a `user_id` nor `alert_channel_id`. This shouldn't happen in normal usage, but if it does:
- The reminder will be skipped
- A warning will be logged
- You'll need to manually assign channels to this reminder after migration

### Error: "Failed to create new tables"

This usually means:
- Tables already exist (check if migration was already run)
- Database permissions issue
- Database connection problem

Check the log file for details.

### Migration Fails Midway

The script uses transactions and will rollback changes if an error occurs. Your database should remain in its original state. Check the log file to see what went wrong.

## Post-Migration Steps

### 1. Update Application Code

After successful migration, update your application to use the new Channel model:

- Remove references to User and AlertChannel models
- Update API endpoints to use `/api/channels`
- Update frontend to use new channel-based UI

### 2. Restart Services

```bash
# If using docker-compose
docker-compose up -d

# Or start individual services
./dev.sh  # or ./prod.sh
```

### 3. Test Functionality

- Create a new channel
- Create a reminder with multiple channels
- Verify notifications are sent correctly
- Check that timezones work as expected

### 4. Clean Up Old Tables (if skipped)

If you used `--skip-cleanup`, you can manually drop old tables later:

```sql
-- After verifying everything works
ALTER TABLE reminders DROP COLUMN user_id;
ALTER TABLE reminders DROP COLUMN alert_channel_id;
DROP TABLE users CASCADE;
DROP TABLE alert_channels CASCADE;
```

## Rollback

If you need to rollback the migration:

### If Migration Failed

The script automatically rolls back failed migrations. Your database should be unchanged.

### If Migration Succeeded but You Want to Revert

1. Stop all services
2. Restore from your backup:

```bash
# For PostgreSQL
psql -U your_user -d ntfy_family < backup_YYYYMMDD_HHMMSS.sql

# Or using Docker
docker exec -i ntfy-family-db psql -U postgres ntfy_family < backup_YYYYMMDD_HHMMSS.sql
```

## Safety Features

The migration script includes several safety features:

1. **Idempotent**: Can be run multiple times safely
2. **Dry Run**: Preview changes before applying
3. **Confirmations**: Prompts before destructive operations
4. **Transaction Rollback**: Automatically reverts on errors
5. **Detailed Logging**: Complete audit trail
6. **Duplicate Detection**: Won't create duplicate channels

## Example Migration Output

```
============================================================
STARTING DATABASE MIGRATION
============================================================
Mode: LIVE MIGRATION
Database: localhost:5432/ntfy_family
============================================================

⚠️  WARNING: This will modify your database!
⚠️  Make sure you have a backup before proceeding!

Do you want to continue? (yes/no): yes

2025-10-05 01:00:00 - INFO - Checking migration prerequisites...
2025-10-05 01:00:00 - INFO - ✓ Prerequisites check passed
2025-10-05 01:00:00 - INFO - Step 1: Creating new tables...
2025-10-05 01:00:00 - INFO - ✓ New tables created successfully
2025-10-05 01:00:01 - INFO - Step 2: Migrating users to channels...
2025-10-05 01:00:01 - INFO - Found 3 users to migrate
2025-10-05 01:00:01 - INFO - Migrated user 'Chris' to channel ID 1
2025-10-05 01:00:01 - INFO - Migrated user 'Mom' to channel ID 2
2025-10-05 01:00:01 - INFO - Migrated user 'Dad' to channel ID 3
2025-10-05 01:00:01 - INFO - ✓ Successfully migrated 3 users to channels
...

============================================================
MIGRATION SUMMARY
============================================================
Users migrated to channels: 3
Alert channels migrated to channels: 1
Reminder-channel relationships created: 12
Reminders updated with timezone: 12

Total new channels created: 4

Old tables have been removed
============================================================

2025-10-05 01:00:05 - INFO - ✓ Migration completed successfully!
```

## Support

If you encounter issues:

1. Check the migration log file
2. Review this README
3. Verify your database backup is valid
4. Check the REFACTOR_PLAN.md for design details

## Summary

The migration process is:
1. ✅ Backup database
2. ✅ Stop services
3. ✅ Run dry run
4. ✅ Review output
5. ✅ Run migration
6. ✅ Verify data
7. ✅ Restart services
8. ✅ Test functionality

Always backup first! 🔒