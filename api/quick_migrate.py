#!/usr/bin/env python3
"""Quick non-interactive migration script"""

from app.db import SessionLocal
from sqlalchemy import text

def main():
    db = SessionLocal()
    
    try:
        print("Starting migration...")
        
        # Step 1: Migrate users to channels
        print("\n1. Migrating users to channels...")
        result = db.execute(text("""
            INSERT INTO channels (name, description, ntfy_topic, timezone, enabled)
            SELECT 
                name,
                'Personal notifications for ' || name,
                ntfy_topic,
                timezone,
                TRUE
            FROM users
            ON CONFLICT (name) DO NOTHING
        """))
        db.commit()
        print(f"   ✓ Migrated {result.rowcount} users to channels")
        
        # Step 2: Migrate alert_channels to channels
        print("\n2. Migrating alert_channels to channels...")
        result = db.execute(text("""
            INSERT INTO channels (name, description, ntfy_topic, timezone, enabled)
            SELECT 
                name,
                COALESCE(description, 'Shared notification channel'),
                ntfy_topic,
                'America/Vancouver',
                enabled
            FROM alert_channels
            ON CONFLICT (name) DO NOTHING
        """))
        db.commit()
        print(f"   ✓ Migrated {result.rowcount} alert channels to channels")
        
        # Step 3: Add timezone column to reminders
        print("\n3. Adding timezone column to reminders...")
        try:
            db.execute(text("""
                ALTER TABLE reminders 
                ADD COLUMN IF NOT EXISTS timezone VARCHAR(64) DEFAULT 'America/Vancouver'
            """))
            db.commit()
            print("   ✓ Added timezone column")
        except Exception as e:
            if "already exists" in str(e):
                print("   ✓ Timezone column already exists")
            else:
                raise
        
        # Step 4: Populate timezone from users
        print("\n4. Populating reminder timezones from users...")
        result = db.execute(text("""
            UPDATE reminders r
            SET timezone = u.timezone
            FROM users u
            WHERE r.user_id = u.id AND r.timezone IS NULL
        """))
        db.commit()
        print(f"   ✓ Updated {result.rowcount} reminder timezones")
        
        # Step 5: Create reminder_channels entries
        print("\n5. Creating reminder-channel associations...")
        
        # For reminders with alert_channel_id
        result = db.execute(text("""
            INSERT INTO reminder_channels (reminder_id, channel_id)
            SELECT DISTINCT r.id, c.id
            FROM reminders r
            JOIN alert_channels ac ON r.alert_channel_id = ac.id
            JOIN channels c ON c.ntfy_topic = ac.ntfy_topic
            WHERE r.alert_channel_id IS NOT NULL
            ON CONFLICT DO NOTHING
        """))
        db.commit()
        print(f"   ✓ Created {result.rowcount} associations from alert_channels")
        
        # For reminders without alert_channel_id (use user's channel)
        result = db.execute(text("""
            INSERT INTO reminder_channels (reminder_id, channel_id)
            SELECT DISTINCT r.id, c.id
            FROM reminders r
            JOIN users u ON r.user_id = u.id
            JOIN channels c ON c.ntfy_topic = u.ntfy_topic
            WHERE r.alert_channel_id IS NULL
            ON CONFLICT DO NOTHING
        """))
        db.commit()
        print(f"   ✓ Created {result.rowcount} associations from users")
        
        # Step 6: Add channel_id to delivery_logs
        print("\n6. Adding channel_id to delivery_logs...")
        try:
            db.execute(text("""
                ALTER TABLE delivery_logs 
                ADD COLUMN IF NOT EXISTS channel_id INTEGER REFERENCES channels(id)
            """))
            db.commit()
            print("   ✓ Added channel_id column to delivery_logs")
        except Exception as e:
            if "already exists" in str(e):
                print("   ✓ channel_id column already exists")
            else:
                raise
        
        print("\n✅ Migration completed successfully!")
        print("\nNext steps:")
        print("1. Restart the API: docker-compose restart api scheduler")
        print("2. Verify the app works at http://192.168.1.185:8080")
        
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    main()