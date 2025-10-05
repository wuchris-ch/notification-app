"""
Integration tests for AI reminder parsing with real OpenRouter API calls.

These tests verify the complete flow from natural language input through
AI parsing to final cron expression generation.

Run with: python -m pytest tests/test_ai_reminder_parsing.py -v
"""

import pytest
import sys
import os
from datetime import datetime
from pathlib import Path

# Load environment variables from .env file
from dotenv import load_dotenv

# Get the project root directory and load .env
project_root = Path(__file__).parent.parent
env_path = project_root / '.env'
load_dotenv(dotenv_path=env_path)

# Add parent directory to path to import from api
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'api'))

from app.ai_service import parse_natural_language_reminder, build_cron_from_structured_data


class TestAIReminderParsing:
    """Test suite for AI-powered reminder parsing with real API calls."""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup for each test - set required environment variables."""
        if not os.getenv("OPENROUTER_API_KEY"):
            pytest.skip("OPENROUTER_API_KEY not set")
        # Set a dummy DATABASE_URL if not present (not needed for AI parsing tests)
        if not os.getenv("DATABASE_URL"):
            os.environ["DATABASE_URL"] = "postgresql://dummy:dummy@localhost/dummy"
    
    def test_simple_time_with_minutes(self):
        """
        Test Case: Simple reminder with specific time including minutes
        Input: "remind me to take out trash at 8:15pm"
        Expected: Cron should be "15 20 * * *" (8:15pm daily)
        """
        input_text = "remind me to take out trash at 8:15pm"
        
        result = parse_natural_language_reminder(input_text, "America/Vancouver")
        
        # Verify structured data
        assert "time" in result, "Missing time data"
        assert result["time"]["hour"] == 20, f"Expected hour=20 (8pm), got {result['time']['hour']}"
        assert result["time"]["minute"] == 15, f"Expected minute=15, got {result['time']['minute']}"
        
        # Verify cron expression
        assert result["cron"] == "15 20 * * *", f"Expected '15 20 * * *', got '{result['cron']}'"
        
        # Verify title
        assert "trash" in result["title"].lower(), f"Title should mention 'trash', got '{result['title']}'"
        
        print(f"✓ Test passed: {input_text}")
        print(f"  → Cron: {result['cron']}")
        print(f"  → Title: {result['title']}")
    
    def test_morning_time_with_minutes(self):
        """
        Test Case: Morning reminder with minutes
        Input: "wake up at 7:30am every day"
        Expected: Cron should be "30 7 * * *" (7:30am daily)
        """
        input_text = "wake up at 7:30am every day"
        
        result = parse_natural_language_reminder(input_text, "America/Vancouver")
        
        assert result["time"]["hour"] == 7, f"Expected hour=7, got {result['time']['hour']}"
        assert result["time"]["minute"] == 30, f"Expected minute=30, got {result['time']['minute']}"
        assert result["cron"] == "30 7 * * *", f"Expected '30 7 * * *', got '{result['cron']}'"
        
        print(f"✓ Test passed: {input_text}")
        print(f"  → Cron: {result['cron']}")
    
    def test_afternoon_time_with_minutes(self):
        """
        Test Case: Afternoon time with minutes
        Input: "lunch meeting at 12:45pm"
        Expected: Cron should be "45 12 * * *" (12:45pm daily)
        """
        input_text = "lunch meeting at 12:45pm"
        
        result = parse_natural_language_reminder(input_text, "America/Vancouver")
        
        assert result["time"]["hour"] == 12, f"Expected hour=12, got {result['time']['hour']}"
        assert result["time"]["minute"] == 45, f"Expected minute=45, got {result['time']['minute']}"
        assert result["cron"] == "45 12 * * *", f"Expected '45 12 * * *', got '{result['cron']}'"
        
        print(f"✓ Test passed: {input_text}")
        print(f"  → Cron: {result['cron']}")
    
    def test_weekly_recurrence(self):
        """
        Test Case: Weekly recurrence on specific day
        Input: "call family member every Sunday at 2:30pm"
        Expected: Cron should be "30 14 * * 0" (2:30pm every Sunday)
        """
        input_text = "call family member every Sunday at 2:30pm"
        
        result = parse_natural_language_reminder(input_text, "America/Vancouver")
        
        assert result["time"]["hour"] == 14, f"Expected hour=14 (2pm), got {result['time']['hour']}"
        assert result["time"]["minute"] == 30, f"Expected minute=30, got {result['time']['minute']}"
        assert result["recurrence"]["type"] == "weekly", f"Expected weekly recurrence"
        assert result["recurrence"]["day_of_week"] == 0, f"Expected Sunday (0)"
        assert result["cron"] == "30 14 * * 0", f"Expected '30 14 * * 0', got '{result['cron']}'"
        
        print(f"✓ Test passed: {input_text}")
        print(f"  → Cron: {result['cron']}")
    
    def test_weekdays_recurrence(self):
        """
        Test Case: Weekdays only recurrence
        Input: "standup meeting weekdays at 9:15am"
        Expected: Cron should be "15 9 * * 1-5" (9:15am Monday-Friday)
        """
        input_text = "standup meeting weekdays at 9:15am"
        
        result = parse_natural_language_reminder(input_text, "America/Vancouver")
        
        assert result["time"]["hour"] == 9, f"Expected hour=9, got {result['time']['hour']}"
        assert result["time"]["minute"] == 15, f"Expected minute=15, got {result['time']['minute']}"
        assert result["recurrence"]["weekdays_only"] == True, f"Expected weekdays_only=True"
        assert result["cron"] == "15 9 * * 1-5", f"Expected '15 9 * * 1-5', got '{result['cron']}'"
        
        print(f"✓ Test passed: {input_text}")
        print(f"  → Cron: {result['cron']}")
    
    def test_on_the_hour(self):
        """
        Test Case: Time on the hour (no minutes)
        Input: "dinner reminder at 6pm"
        Expected: Cron should be "0 18 * * *" (6:00pm daily)
        """
        input_text = "dinner reminder at 6pm"
        
        result = parse_natural_language_reminder(input_text, "America/Vancouver")
        
        assert result["time"]["hour"] == 18, f"Expected hour=18 (6pm), got {result['time']['hour']}"
        assert result["time"]["minute"] == 0, f"Expected minute=0, got {result['time']['minute']}"
        assert result["cron"] == "0 18 * * *", f"Expected '0 18 * * *', got '{result['cron']}'"
        
        print(f"✓ Test passed: {input_text}")
        print(f"  → Cron: {result['cron']}")
    
    def test_specific_date_short_format(self):
        """
        Test Case: Specific date in short format
        Input: "set reminder oct 12 to run"
        Expected: Cron should be "0 8 12 10 *" (October 12 at 8am yearly)
        """
        input_text = "set reminder oct 12 to run"
        
        result = parse_natural_language_reminder(input_text, "America/Vancouver")
        
        assert result["recurrence"]["type"] == "yearly", f"Expected yearly recurrence, got {result['recurrence']['type']}"
        assert result["recurrence"]["month"] == 10, f"Expected month=10 (October), got {result['recurrence']['month']}"
        assert result["recurrence"]["day_of_month"] == 12, f"Expected day_of_month=12, got {result['recurrence']['day_of_month']}"
        assert result["cron"] == "0 8 12 10 *", f"Expected '0 8 12 10 *', got '{result['cron']}'"
        
        print(f"✓ Test passed: {input_text}")
        print(f"  → Cron: {result['cron']}")
        print(f"  → Schedule: {result['schedule_description']}")
    
    def test_specific_date_full_month(self):
        """
        Test Case: Specific date with full month name
        Input: "remind me on December 25 to call family"
        Expected: Cron should be "0 8 25 12 *" (December 25 at 8am yearly)
        """
        input_text = "remind me on December 25 to call family"
        
        result = parse_natural_language_reminder(input_text, "America/Vancouver")
        
        assert result["recurrence"]["type"] == "yearly", f"Expected yearly recurrence, got {result['recurrence']['type']}"
        assert result["recurrence"]["month"] == 12, f"Expected month=12 (December), got {result['recurrence']['month']}"
        assert result["recurrence"]["day_of_month"] == 25, f"Expected day_of_month=25, got {result['recurrence']['day_of_month']}"
        assert result["cron"] == "0 8 25 12 *", f"Expected '0 8 25 12 *', got '{result['cron']}'"
        
        print(f"✓ Test passed: {input_text}")
        print(f"  → Cron: {result['cron']}")
        print(f"  → Schedule: {result['schedule_description']}")
    
    def test_specific_date_with_time(self):
        """
        Test Case: Specific date with specific time
        Input: "March 15 at 3pm doctor appointment"
        Expected: Cron should be "0 15 15 3 *" (March 15 at 3pm yearly)
        """
        input_text = "March 15 at 3pm doctor appointment"
        
        result = parse_natural_language_reminder(input_text, "America/Vancouver")
        
        assert result["recurrence"]["type"] == "yearly", f"Expected yearly recurrence, got {result['recurrence']['type']}"
        assert result["recurrence"]["month"] == 3, f"Expected month=3 (March), got {result['recurrence']['month']}"
        assert result["recurrence"]["day_of_month"] == 15, f"Expected day_of_month=15, got {result['recurrence']['day_of_month']}"
        assert result["time"]["hour"] == 15, f"Expected hour=15 (3pm), got {result['time']['hour']}"
        assert result["cron"] == "0 15 15 3 *", f"Expected '0 15 15 3 *', got '{result['cron']}'"
        
        print(f"✓ Test passed: {input_text}")
        print(f"  → Cron: {result['cron']}")
        print(f"  → Schedule: {result['schedule_description']}")


class TestCronBuilder:
    """Test the deterministic cron builder function."""
    
    def test_build_cron_daily_with_minutes(self):
        """Test building daily cron with specific minutes."""
        data = {
            "time": {"hour": 20, "minute": 15},
            "recurrence": {"type": "daily"}
        }
        
        cron = build_cron_from_structured_data(data)
        assert cron == "15 20 * * *", f"Expected '15 20 * * *', got '{cron}'"
    
    def test_build_cron_weekdays(self):
        """Test building weekdays-only cron."""
        data = {
            "time": {"hour": 9, "minute": 30},
            "recurrence": {"type": "daily", "weekdays_only": True}
        }
        
        cron = build_cron_from_structured_data(data)
        assert cron == "30 9 * * 1-5", f"Expected '30 9 * * 1-5', got '{cron}'"
    
    def test_build_cron_weekly(self):
        """Test building weekly cron for specific day."""
        data = {
            "time": {"hour": 14, "minute": 0},
            "recurrence": {"type": "weekly", "day_of_week": 0}
        }
        
        cron = build_cron_from_structured_data(data)
        assert cron == "0 14 * * 0", f"Expected '0 14 * * 0', got '{cron}'"
    
    def test_build_cron_validates_hour(self):
        """Test that invalid hours are rejected."""
        data = {
            "time": {"hour": 25, "minute": 0},  # Invalid hour
            "recurrence": {"type": "daily"}
        }
        
        with pytest.raises(ValueError, match="Invalid hour"):
            build_cron_from_structured_data(data)
    
    def test_build_cron_validates_minute(self):
        """Test that invalid minutes are rejected."""
        data = {
            "time": {"hour": 12, "minute": 75},  # Invalid minute
            "recurrence": {"type": "daily"}
        }
        
        with pytest.raises(ValueError, match="Invalid minute"):
            build_cron_from_structured_data(data)
    
    def test_build_cron_yearly(self):
        """Test building yearly cron for specific date."""
        data = {
            "time": {"hour": 8, "minute": 0},
            "recurrence": {"type": "yearly", "month": 10, "day_of_month": 12}
        }
        
        cron = build_cron_from_structured_data(data)
        assert cron == "0 8 12 10 *", f"Expected '0 8 12 10 *', got '{cron}'"
    
    def test_build_cron_monthly(self):
        """Test building monthly cron."""
        data = {
            "time": {"hour": 9, "minute": 30},
            "recurrence": {"type": "monthly", "day_of_month": 15}
        }
        
        cron = build_cron_from_structured_data(data)
        assert cron == "30 9 15 * *", f"Expected '30 9 15 * *', got '{cron}'"


if __name__ == "__main__":
    # Allow running tests directly
    pytest.main([__file__, "-v", "-s"])