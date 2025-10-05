# AI Reminder Parsing Tests

This directory contains integration tests for the AI-powered reminder parsing system.

## Test Coverage

The test suite verifies the complete end-to-end flow:
1. Natural language input (e.g., "remind me at 8:15pm")
2. AI parsing via OpenRouter API
3. Structured data extraction (hour, minute, recurrence)
4. Deterministic cron expression generation
5. Final reminder data validation

## Test Files

- **`test_ai_reminder_parsing.py`** - Main integration tests with real OpenRouter API calls

## Running Tests

### Prerequisites

1. Install pytest:
   ```bash
   pip install pytest
   ```

2. Set your OpenRouter API key:
   ```bash
   export OPENROUTER_API_KEY="your-key-here"
   ```

### Run All Tests

```bash
# From project root - load environment variables first
cd /home/chris/ntfy-family && set -a && source .env && set +a && python -m pytest tests/test_ai_reminder_parsing.py -v

# With detailed output
cd /home/chris/ntfy-family && set -a && source .env && set +a && python -m pytest tests/test_ai_reminder_parsing.py -v -s

# Run only integration tests (with real API calls)
cd /home/chris/ntfy-family && set -a && source .env && set +a && python -m pytest tests/test_ai_reminder_parsing.py::TestAIReminderParsing -v -s

# Run only unit tests (no API calls needed)
python -m pytest tests/test_ai_reminder_parsing.py::TestCronBuilder -v
```

### Run Specific Test

```bash
python -m pytest tests/test_ai_reminder_parsing.py::TestAIReminderParsing::test_simple_time_with_minutes -v
```

## Test Cases

### Integration Tests (with real API calls)

1. **test_simple_time_with_minutes** - "remind me to take out trash at 8:15pm"
   - Verifies: `15 20 * * *` (8:15pm daily)

2. **test_morning_time_with_minutes** - "wake up at 7:30am every day"
   - Verifies: `30 7 * * *` (7:30am daily)

3. **test_afternoon_time_with_minutes** - "lunch meeting at 12:45pm"
   - Verifies: `45 12 * * *` (12:45pm daily)

4. **test_weekly_recurrence** - "call mom every Sunday at 2:30pm"
   - Verifies: `30 14 * * 0` (2:30pm Sundays)

5. **test_weekdays_recurrence** - "standup meeting weekdays at 9:15am"
   - Verifies: `15 9 * * 1-5` (9:15am Monday-Friday)

6. **test_on_the_hour** - "dinner reminder at 6pm"
   - Verifies: `0 18 * * *` (6:00pm daily)

### Unit Tests (deterministic, no API calls)

1. **test_build_cron_daily_with_minutes** - Validates cron builder for daily reminders
2. **test_build_cron_weekdays** - Validates weekdays-only cron generation
3. **test_build_cron_weekly** - Validates weekly recurrence
4. **test_build_cron_validates_hour** - Ensures invalid hours are rejected
5. **test_build_cron_validates_minute** - Ensures invalid minutes are rejected

## Expected Output

```
tests/test_ai_reminder_parsing.py::TestAIReminderParsing::test_simple_time_with_minutes PASSED
✓ Test passed: remind me to take out trash at 8:15pm
  → Cron: 15 20 * * *
  → Title: Take out trash

tests/test_ai_reminder_parsing.py::TestAIReminderParsing::test_morning_time_with_minutes PASSED
✓ Test passed: wake up at 7:30am every day
  → Cron: 30 7 * * *
...
```

## Notes

- Integration tests make real API calls to OpenRouter, so they require an active internet connection and valid API key
- Tests are designed to be minimal to avoid excessive API usage while still providing robust coverage
- Each test validates both the structured data (hour/minute) and the final cron expression
- Unit tests for the cron builder are deterministic and don't require API access