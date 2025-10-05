# Running AI Reminder Parsing Tests

## Quick Start

Simply run:

```bash
python -m pytest tests/test_ai_reminder_parsing.py -v
```

That's it! The test automatically loads environment variables from the `.env` file in the project root.

## What Gets Tested

### AI Integration Tests (with real OpenRouter API):
1. ✅ Simple time with minutes: "remind me to take out trash at 8:15pm"
2. ✅ Morning time with minutes: "wake up at 7:30am every day"
3. ✅ Afternoon time with minutes: "lunch meeting at 12:45pm"
4. ✅ Weekly recurrence: "call family member every Sunday at 2:30pm"
5. ✅ Weekdays recurrence: "standup meeting weekdays at 9:15am"
6. ✅ On the hour: "dinner reminder at 6pm"

### Cron Builder Tests (deterministic validation):
7. ✅ Daily cron with minutes
8. ✅ Weekdays-only cron
9. ✅ Weekly cron for specific day
10. ✅ Hour validation (rejects invalid hours)
11. ✅ Minute validation (rejects invalid minutes)

## Requirements

- `OPENROUTER_API_KEY` must be set in `.env` file
- `python-dotenv` package (already in requirements.txt)

## Alternative: Run Specific Test

```bash
# Run just one test
python -m pytest tests/test_ai_reminder_parsing.py::TestAIReminderParsing::test_simple_time_with_minutes -v

# Run with output
python -m pytest tests/test_ai_reminder_parsing.py -v -s
```

## Notes

- Tests make real API calls to OpenRouter
- Each AI test takes ~3-5 seconds
- Total runtime: ~20-30 seconds for all tests
- The `.env` file is automatically loaded, so no manual environment setup needed