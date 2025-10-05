# Migration Quick Start Guide

## TL;DR - Run the Migration

```bash
# 1. Backup database
docker exec ntfy-family-db pg_dump -U postgres ntfy_family > backup.sql

# 2. Stop services
docker-compose down

# 3. Preview changes (dry run)
cd api
python migrate_to_channels.py --dry-run

# 4. Run migration
python migrate_to_channels.py

# 5. Restart services
cd ..
docker-compose up -d
```

## Command Options

```bash
# Preview without making changes
python migrate_to_channels.py --dry-run

# Run migration (default: removes old tables after confirmation)
python migrate_to_channels.py

# Keep old tables for verification
python migrate_to_channels.py --skip-cleanup

# Force cleanup of old tables
python migrate_to_channels.py --cleanup
```

## What Happens

1. ✅ Creates `channels` and `reminder_channels` tables
2. ✅ Migrates users → channels (description: "Personal notifications for {name}")
3. ✅ Migrates alert_channels → channels (keeps original description)
4. ✅ Links reminders to appropriate channels
5. ✅ Adds timezone to reminders (from user data)
6. ✅ Optionally removes old `users` and `alert_channels` tables

## Safety Features

- 🔒 Dry run mode to preview changes
- 🔒 Confirmation prompts before destructive operations
- 🔒 Automatic rollback on errors
- 🔒 Idempotent (safe to run multiple times)
- 🔒 Detailed logging to file

## Verify Migration

```sql
-- Check channels
SELECT id, name, ntfy_topic, timezone FROM channels;

-- Check reminder-channel links
SELECT r.title, c.name 
FROM reminders r
JOIN reminder_channels rc ON r.id = rc.reminder_id
JOIN channels c ON rc.channel_id = c.id;

-- Check reminder timezones
SELECT id, title, timezone FROM reminders;
```

## Rollback

```bash
# Restore from backup
docker exec -i ntfy-family-db psql -U postgres ntfy_family < backup.sql
```

## Need Help?

See [`MIGRATION_README.md`](./MIGRATION_README.md) for complete documentation.