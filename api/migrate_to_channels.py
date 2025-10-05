#!/usr/bin/env python3
"""
Database Migration Script: User/AlertChannel Model to Channel-Only Model

This script migrates the ntfy-family database from the old dual-model design
(User + AlertChannel) to the new unified Channel model.

Usage:
    # Dry run (preview changes without committing)
    python migrate_to_channels.py --dry-run

    # Run migration (commits changes)
    python migrate_to_channels.py

    # Run migration and keep old tables
    python migrate_to_channels.py --skip-cleanup

    # Full migration with cleanup
    python migrate_to_channels.py --cleanup

IMPORTANT: 
- Backup your database before running this script!
- Review the dry-run output before running the actual migration
- The script is idempotent and can be run multiple times safely
"""

import sys
import argparse
import logging
from typing import List, Dict, Any
from datetime import datetime

from sqlalchemy import create_engine, text, inspect, MetaData, Table
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.exc import SQLAlchemyError, IntegrityError

# Import models and config
from app.config import settings
from app.models import (
    Base, Channel, ReminderChannel, User, AlertChannel, 
    Reminder, DeliveryLog
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(f'migration_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log')
    ]
)
logger = logging.getLogger(__name__)


class MigrationError(Exception):
    """Custom exception for migration errors"""
    pass


class DatabaseMigration:
    """Handles the migration from User/AlertChannel to Channel-only model"""
    
    def __init__(self, dry_run: bool = False, skip_cleanup: bool = False):
        self.dry_run = dry_run
        self.skip_cleanup = skip_cleanup
        self.engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
        self.SessionLocal = sessionmaker(bind=self.engine, autoflush=False, autocommit=False)
        self.stats = {
            'users_migrated': 0,
            'alert_channels_migrated': 0,
            'reminder_channels_created': 0,
            'reminders_updated': 0,
            'delivery_logs_updated': 0,
        }
        
    def log_step(self, message: str, level: str = 'info'):
        """Log a migration step"""
        prefix = "[DRY RUN] " if self.dry_run else ""
        full_message = f"{prefix}{message}"
        
        if level == 'info':
            logger.info(full_message)
        elif level == 'warning':
            logger.warning(full_message)
        elif level == 'error':
            logger.error(full_message)
        elif level == 'success':
            logger.info(f"✓ {full_message}")
    
    def check_prerequisites(self, session: Session) -> bool:
        """Check if migration prerequisites are met"""
        self.log_step("Checking migration prerequisites...")
        
        inspector = inspect(self.engine)
        existing_tables = inspector.get_table_names()
        
        # Check if old tables exist
        if 'users' not in existing_tables and 'alert_channels' not in existing_tables:
            self.log_step("No old tables found. Migration may have already been completed.", 'warning')
            return False
        
        # Check if new tables already exist
        if 'channels' in existing_tables:
            channel_count = session.query(Channel).count()
            if channel_count > 0:
                self.log_step(f"Channel table already has {channel_count} records. Migration may have been partially completed.", 'warning')
                response = input("Continue anyway? (yes/no): ").lower()
                if response != 'yes':
                    return False
        
        self.log_step("Prerequisites check passed", 'success')
        return True
    
    def create_new_tables(self, session: Session):
        """Create Channel and ReminderChannel tables if they don't exist"""
        self.log_step("Step 1: Creating new tables (channels, reminder_channels)...")
        
        if self.dry_run:
            self.log_step("Would create tables: channels, reminder_channels")
            return
        
        try:
            # Create all tables defined in Base
            Base.metadata.create_all(bind=self.engine)
            self.log_step("New tables created successfully", 'success')
        except SQLAlchemyError as e:
            raise MigrationError(f"Failed to create new tables: {e}")
    
    def migrate_users_to_channels(self, session: Session) -> Dict[int, int]:
        """
        Migrate User records to Channel records
        Returns mapping of old user_id to new channel_id
        """
        self.log_step("Step 2: Migrating users to channels...")
        
        users = session.query(User).all()
        user_to_channel_map = {}
        
        if not users:
            self.log_step("No users found to migrate", 'warning')
            return user_to_channel_map
        
        self.log_step(f"Found {len(users)} users to migrate")
        
        for user in users:
            if self.dry_run:
                self.log_step(f"Would migrate user '{user.name}' -> channel with topic '{user.ntfy_topic}'")
                user_to_channel_map[user.id] = -1  # Placeholder for dry run
                continue
            
            try:
                # Check if channel already exists with this topic
                existing_channel = session.query(Channel).filter_by(ntfy_topic=user.ntfy_topic).first()
                
                if existing_channel:
                    self.log_step(f"Channel already exists for user '{user.name}', using existing channel", 'warning')
                    user_to_channel_map[user.id] = existing_channel.id
                    continue
                
                # Create new channel from user
                channel = Channel(
                    name=user.name,
                    description=f"Personal notifications for {user.name}",
                    ntfy_topic=user.ntfy_topic,
                    timezone=user.timezone or "America/Vancouver",
                    enabled=True
                )
                session.add(channel)
                session.flush()  # Get the ID without committing
                
                user_to_channel_map[user.id] = channel.id
                self.stats['users_migrated'] += 1
                self.log_step(f"Migrated user '{user.name}' to channel ID {channel.id}")
                
            except IntegrityError as e:
                session.rollback()
                raise MigrationError(f"Failed to migrate user '{user.name}': {e}")
        
        if not self.dry_run:
            session.commit()
            self.log_step(f"Successfully migrated {self.stats['users_migrated']} users to channels", 'success')
        
        return user_to_channel_map
    
    def migrate_alert_channels_to_channels(self, session: Session) -> Dict[int, int]:
        """
        Migrate AlertChannel records to Channel records
        Returns mapping of old alert_channel_id to new channel_id
        """
        self.log_step("Step 3: Migrating alert channels to channels...")
        
        alert_channels = session.query(AlertChannel).all()
        alert_to_channel_map = {}
        
        if not alert_channels:
            self.log_step("No alert channels found to migrate", 'warning')
            return alert_to_channel_map
        
        self.log_step(f"Found {len(alert_channels)} alert channels to migrate")
        
        for alert_channel in alert_channels:
            if self.dry_run:
                self.log_step(f"Would migrate alert channel '{alert_channel.name}' -> channel with topic '{alert_channel.ntfy_topic}'")
                alert_to_channel_map[alert_channel.id] = -1  # Placeholder for dry run
                continue
            
            try:
                # Check if channel already exists with this topic
                existing_channel = session.query(Channel).filter_by(ntfy_topic=alert_channel.ntfy_topic).first()
                
                if existing_channel:
                    self.log_step(f"Channel already exists for alert channel '{alert_channel.name}', using existing channel", 'warning')
                    alert_to_channel_map[alert_channel.id] = existing_channel.id
                    continue
                
                # Create new channel from alert channel
                channel = Channel(
                    name=alert_channel.name,
                    description=alert_channel.description or f"Alert channel: {alert_channel.name}",
                    ntfy_topic=alert_channel.ntfy_topic,
                    timezone="America/Vancouver",  # Default timezone for alert channels
                    enabled=alert_channel.enabled
                )
                session.add(channel)
                session.flush()  # Get the ID without committing
                
                alert_to_channel_map[alert_channel.id] = channel.id
                self.stats['alert_channels_migrated'] += 1
                self.log_step(f"Migrated alert channel '{alert_channel.name}' to channel ID {channel.id}")
                
            except IntegrityError as e:
                session.rollback()
                raise MigrationError(f"Failed to migrate alert channel '{alert_channel.name}': {e}")
        
        if not self.dry_run:
            session.commit()
            self.log_step(f"Successfully migrated {self.stats['alert_channels_migrated']} alert channels to channels", 'success')
        
        return alert_to_channel_map
    
    def migrate_reminder_relationships(
        self, 
        session: Session, 
        user_to_channel_map: Dict[int, int],
        alert_to_channel_map: Dict[int, int]
    ):
        """Create ReminderChannel entries from old reminder relationships"""
        self.log_step("Step 4: Migrating reminder-channel relationships...")
        
        reminders = session.query(Reminder).all()
        
        if not reminders:
            self.log_step("No reminders found to migrate", 'warning')
            return
        
        self.log_step(f"Found {len(reminders)} reminders to process")
        
        for reminder in reminders:
            if self.dry_run:
                if reminder.alert_channel_id:
                    self.log_step(f"Would link reminder '{reminder.title}' to alert channel's new channel")
                elif reminder.user_id:
                    self.log_step(f"Would link reminder '{reminder.title}' to user's new channel")
                else:
                    self.log_step(f"Warning: Reminder '{reminder.title}' has no user or alert channel!", 'warning')
                continue
            
            try:
                # Determine which channel to link to
                channel_id = None
                
                if reminder.alert_channel_id and reminder.alert_channel_id in alert_to_channel_map:
                    # Reminder was sent to alert channel
                    channel_id = alert_to_channel_map[reminder.alert_channel_id]
                elif reminder.user_id and reminder.user_id in user_to_channel_map:
                    # Reminder was sent to user
                    channel_id = user_to_channel_map[reminder.user_id]
                else:
                    self.log_step(f"Warning: Could not find channel for reminder '{reminder.title}'", 'warning')
                    continue
                
                # Check if relationship already exists
                existing = session.query(ReminderChannel).filter_by(
                    reminder_id=reminder.id,
                    channel_id=channel_id
                ).first()
                
                if existing:
                    self.log_step(f"Relationship already exists for reminder '{reminder.title}'", 'warning')
                    continue
                
                # Create reminder-channel relationship
                reminder_channel = ReminderChannel(
                    reminder_id=reminder.id,
                    channel_id=channel_id
                )
                session.add(reminder_channel)
                self.stats['reminder_channels_created'] += 1
                self.log_step(f"Linked reminder '{reminder.title}' to channel ID {channel_id}")
                
            except IntegrityError as e:
                session.rollback()
                raise MigrationError(f"Failed to create reminder-channel relationship for '{reminder.title}': {e}")
        
        if not self.dry_run:
            session.commit()
            self.log_step(f"Successfully created {self.stats['reminder_channels_created']} reminder-channel relationships", 'success')
    
    def add_timezone_to_reminders(self, session: Session):
        """Add timezone field to reminders and populate from user data"""
        self.log_step("Step 5: Adding timezone to reminders...")
        
        # Check if timezone column already exists and has data
        reminders_with_timezone = session.query(Reminder).filter(Reminder.timezone.isnot(None)).count()
        total_reminders = session.query(Reminder).count()
        
        if reminders_with_timezone == total_reminders and total_reminders > 0:
            self.log_step(f"All {total_reminders} reminders already have timezone set", 'warning')
            return
        
        reminders = session.query(Reminder).filter(Reminder.timezone.is_(None)).all()
        
        if not reminders:
            self.log_step("No reminders need timezone update")
            return
        
        self.log_step(f"Found {len(reminders)} reminders to update with timezone")
        
        for reminder in reminders:
            if self.dry_run:
                timezone = "America/Vancouver"
                if reminder.user_id:
                    user = session.query(User).filter_by(id=reminder.user_id).first()
                    if user:
                        timezone = user.timezone or "America/Vancouver"
                self.log_step(f"Would set timezone '{timezone}' for reminder '{reminder.title}'")
                continue
            
            try:
                # Get timezone from user if available
                timezone = "America/Vancouver"  # Default
                if reminder.user_id:
                    user = session.query(User).filter_by(id=reminder.user_id).first()
                    if user and user.timezone:
                        timezone = user.timezone
                
                reminder.timezone = timezone
                self.stats['reminders_updated'] += 1
                self.log_step(f"Set timezone '{timezone}' for reminder '{reminder.title}'")
                
            except SQLAlchemyError as e:
                session.rollback()
                raise MigrationError(f"Failed to update timezone for reminder '{reminder.title}': {e}")
        
        if not self.dry_run:
            session.commit()
            self.log_step(f"Successfully updated timezone for {self.stats['reminders_updated']} reminders", 'success')
    
    def update_delivery_logs(self, session: Session):
        """Add channel_id to delivery logs (nullable for old logs)"""
        self.log_step("Step 6: Updating delivery logs...")
        
        # Note: channel_id is nullable, so old logs without channel_id are fine
        # This step is mainly informational
        
        total_logs = session.query(DeliveryLog).count()
        logs_with_channel = session.query(DeliveryLog).filter(DeliveryLog.channel_id.isnot(None)).count()
        logs_without_channel = total_logs - logs_with_channel
        
        self.log_step(f"Delivery logs status: {logs_with_channel} with channel_id, {logs_without_channel} without (legacy)")
        self.log_step("Note: Old delivery logs will keep channel_id as NULL (this is expected)", 'success')
    
    def cleanup_old_tables(self, session: Session):
        """Drop old User and AlertChannel tables (with confirmation)"""
        self.log_step("Step 7: Cleaning up old tables...")
        
        if self.skip_cleanup:
            self.log_step("Skipping cleanup (--skip-cleanup flag set)")
            return
        
        inspector = inspect(self.engine)
        existing_tables = inspector.get_table_names()
        
        tables_to_drop = []
        if 'users' in existing_tables:
            tables_to_drop.append('users')
        if 'alert_channels' in existing_tables:
            tables_to_drop.append('alert_channels')
        
        if not tables_to_drop:
            self.log_step("No old tables to clean up")
            return
        
        if self.dry_run:
            self.log_step(f"Would drop tables: {', '.join(tables_to_drop)}")
            self.log_step("Would also drop foreign key columns: user_id, alert_channel_id from reminders")
            return
        
        # Confirm before dropping tables
        self.log_step(f"About to drop tables: {', '.join(tables_to_drop)}", 'warning')
        response = input("Are you sure you want to drop these tables? This cannot be undone! (yes/no): ").lower()
        
        if response != 'yes':
            self.log_step("Cleanup cancelled by user")
            return
        
        try:
            # First, drop foreign key columns from reminders table
            self.log_step("Dropping foreign key columns from reminders table...")
            
            # SQLAlchemy doesn't support ALTER TABLE DROP COLUMN directly,
            # so we use raw SQL
            with self.engine.connect() as conn:
                # Make columns nullable first (if not already)
                conn.execute(text("ALTER TABLE reminders ALTER COLUMN user_id DROP NOT NULL"))
                conn.execute(text("ALTER TABLE reminders ALTER COLUMN alert_channel_id DROP NOT NULL"))
                
                # Drop the columns
                conn.execute(text("ALTER TABLE reminders DROP COLUMN IF EXISTS user_id"))
                conn.execute(text("ALTER TABLE reminders DROP COLUMN IF EXISTS alert_channel_id"))
                conn.commit()
            
            self.log_step("Dropped foreign key columns from reminders")
            
            # Now drop the old tables
            for table_name in tables_to_drop:
                self.log_step(f"Dropping table '{table_name}'...")
                with self.engine.connect() as conn:
                    conn.execute(text(f"DROP TABLE IF EXISTS {table_name} CASCADE"))
                    conn.commit()
                self.log_step(f"Dropped table '{table_name}'")
            
            self.log_step("Successfully cleaned up old tables", 'success')
            
        except SQLAlchemyError as e:
            raise MigrationError(f"Failed to cleanup old tables: {e}")
    
    def print_summary(self):
        """Print migration summary"""
        self.log_step("\n" + "="*60)
        self.log_step("MIGRATION SUMMARY")
        self.log_step("="*60)
        
        if self.dry_run:
            self.log_step("DRY RUN - No changes were made to the database", 'warning')
        
        self.log_step(f"Users migrated to channels: {self.stats['users_migrated']}")
        self.log_step(f"Alert channels migrated to channels: {self.stats['alert_channels_migrated']}")
        self.log_step(f"Reminder-channel relationships created: {self.stats['reminder_channels_created']}")
        self.log_step(f"Reminders updated with timezone: {self.stats['reminders_updated']}")
        
        total_channels = self.stats['users_migrated'] + self.stats['alert_channels_migrated']
        self.log_step(f"\nTotal new channels created: {total_channels}")
        
        if not self.dry_run and not self.skip_cleanup:
            self.log_step("\nOld tables have been removed")
        elif self.skip_cleanup:
            self.log_step("\nOld tables were kept (--skip-cleanup flag)", 'warning')
        
        self.log_step("="*60 + "\n")
    
    def migrate_data(self):
        """Main migration function that orchestrates the entire migration"""
        self.log_step("\n" + "="*60)
        self.log_step("STARTING DATABASE MIGRATION")
        self.log_step("="*60)
        self.log_step(f"Mode: {'DRY RUN' if self.dry_run else 'LIVE MIGRATION'}")
        self.log_step(f"Database: {settings.DATABASE_URL.split('@')[-1]}")  # Hide credentials
        self.log_step("="*60 + "\n")
        
        if not self.dry_run:
            self.log_step("⚠️  WARNING: This will modify your database!", 'warning')
            self.log_step("⚠️  Make sure you have a backup before proceeding!", 'warning')
            response = input("\nDo you want to continue? (yes/no): ").lower()
            if response != 'yes':
                self.log_step("Migration cancelled by user")
                return False
        
        session = self.SessionLocal()
        
        try:
            # Check prerequisites
            if not self.check_prerequisites(session):
                self.log_step("Migration aborted due to failed prerequisites", 'error')
                return False
            
            # Step 1: Create new tables
            self.create_new_tables(session)
            
            # Step 2: Migrate users to channels
            user_to_channel_map = self.migrate_users_to_channels(session)
            
            # Step 3: Migrate alert channels to channels
            alert_to_channel_map = self.migrate_alert_channels_to_channels(session)
            
            # Step 4: Migrate reminder relationships
            self.migrate_reminder_relationships(session, user_to_channel_map, alert_to_channel_map)
            
            # Step 5: Add timezone to reminders
            self.add_timezone_to_reminders(session)
            
            # Step 6: Update delivery logs (informational)
            self.update_delivery_logs(session)
            
            # Step 7: Cleanup old tables
            self.cleanup_old_tables(session)
            
            # Print summary
            self.print_summary()
            
            if self.dry_run:
                self.log_step("✓ Dry run completed successfully. Review the output above.", 'success')
                self.log_step("✓ Run without --dry-run to apply changes.", 'success')
            else:
                self.log_step("✓ Migration completed successfully!", 'success')
            
            return True
            
        except MigrationError as e:
            self.log_step(f"Migration failed: {e}", 'error')
            if not self.dry_run:
                self.log_step("Rolling back changes...", 'warning')
                session.rollback()
            return False
            
        except Exception as e:
            self.log_step(f"Unexpected error during migration: {e}", 'error')
            if not self.dry_run:
                self.log_step("Rolling back changes...", 'warning')
                session.rollback()
            return False
            
        finally:
            session.close()


def main():
    """Main entry point for the migration script"""
    parser = argparse.ArgumentParser(
        description='Migrate ntfy-family database from User/AlertChannel to Channel-only model',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Preview changes without committing
  python migrate_to_channels.py --dry-run
  
  # Run migration
  python migrate_to_channels.py
  
  # Run migration but keep old tables
  python migrate_to_channels.py --skip-cleanup
  
  # Run full migration with cleanup
  python migrate_to_channels.py --cleanup

IMPORTANT: Always backup your database before running this migration!
        """
    )
    
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Preview changes without committing to database'
    )
    
    parser.add_argument(
        '--skip-cleanup',
        action='store_true',
        help='Keep old User and AlertChannel tables after migration'
    )
    
    parser.add_argument(
        '--cleanup',
        action='store_true',
        help='Drop old tables after migration (default behavior)'
    )
    
    args = parser.parse_args()
    
    # Handle cleanup flag
    skip_cleanup = args.skip_cleanup
    if args.cleanup:
        skip_cleanup = False
    
    # Print banner
    print("\n" + "="*60)
    print("  NTFY-FAMILY DATABASE MIGRATION")
    print("  User/AlertChannel → Channel-Only Model")
    print("="*60 + "\n")
    
    if args.dry_run:
        print("🔍 Running in DRY RUN mode - no changes will be made\n")
    else:
        print("⚠️  LIVE MIGRATION MODE - database will be modified!")
        print("⚠️  Make sure you have a backup!\n")
    
    # Create and run migration
    migration = DatabaseMigration(dry_run=args.dry_run, skip_cleanup=skip_cleanup)
    success = migration.migrate_data()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()