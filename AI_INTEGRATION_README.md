# AI-Powered Reminder Integration

This document describes the AI integration added to the ntfy-family application that allows users to create reminders using natural language input.

## Overview

The AI integration uses OpenRouter with the xAI Grok 4 Fast (free) model to parse natural language descriptions into structured reminder data. Users can simply type what they want to be reminded about in plain English, and the AI will automatically:

- Extract the reminder title and optional message
- Determine the appropriate schedule (daily, weekly, monthly, etc.)
- Generate a valid cron expression
- Provide a human-readable schedule description

## Features

### Natural Language Processing
- **Smart Parsing**: Understands various ways of expressing time and frequency
- **Context Awareness**: Makes intelligent assumptions based on context (e.g., "medication" defaults to daily)
- **Timezone Support**: Respects user's timezone for scheduling
- **Confidence Scoring**: Provides confidence levels (high/medium/low) for parsed results

### Supported Patterns
- **Daily**: "every day", "daily", "each day"
- **Weekdays**: "weekdays", "Monday through Friday"
- **Weekly**: "every Monday", "each Sunday", "weekly"
- **Monthly**: "1st of every month", "monthly on the 15th"
- **Yearly**: "every Christmas", "annually on March 1st"
- **Custom**: Complex patterns that generate custom cron expressions

### Time Recognition
- **12-hour format**: "8am", "2:30pm", "noon", "midnight"
- **24-hour format**: "08:00", "14:30", "23:45"
- **Natural language**: "morning", "evening", "bedtime"

## API Endpoints

### Parse Reminder (Preview)
```
POST /reminders/ai/parse
```
Parses natural language input and returns structured data without creating a reminder.

**Request Body:**
```json
{
  "user_id": 1,
  "alert_channel_id": 2,  // optional
  "natural_language": "Remind me to take my medication every day at 8am"
}
```

**Response:**
```json
{
  "title": "Take Medication",
  "body": "Remember to take your daily medication",
  "cron": "0 8 * * *",
  "schedule_description": "Daily at 8:00 AM",
  "confidence": "high",
  "next_execution": "2025-09-26T08:00:00"
}
```

### Create AI Reminder
```
POST /reminders/ai/create
```
Parses natural language input and creates a reminder in one step.

**Request Body:**
```json
{
  "user_id": 1,
  "alert_channel_id": 2,  // optional
  "natural_language": "Call mom every Sunday at 2pm"
}
```

**Response:**
```json
{
  "id": 123,
  "user_id": 1,
  "alert_channel_id": 2,
  "title": "Call Mom",
  "body": null,
  "cron": "0 14 * * 0",
  "enabled": true,
  "created_at": "2025-09-25T23:58:23.784Z"
}
```

## Frontend Integration

### AI-Powered Input Section
The new reminder page (`/new`) now includes an AI-powered section at the top with:

1. **Natural Language Input**: Large textarea for describing the reminder
2. **Parse Button**: Previews the AI interpretation without creating
3. **Create Button**: Creates the reminder directly from natural language
4. **Confidence Indicator**: Shows AI confidence level (high/medium/low)
5. **Preview Display**: Shows parsed title, message, schedule, and cron

### User Experience
- **Progressive Enhancement**: Traditional form still available as fallback
- **Real-time Feedback**: Immediate parsing results with confidence scores
- **Error Handling**: Clear error messages for parsing failures
- **Auto-fill**: Parsed data can populate the traditional form for editing

## Configuration

### Environment Variables
Add to your `.env` file:
```bash
OPENROUTER_API_KEY=sk-or-v1-your-api-key-here
```

### Model Configuration
Currently configured to use:
- **Provider**: OpenRouter
- **Model**: `x-ai/grok-4-fast:free`
- **Temperature**: 0.1 (for consistent results)
- **Max Tokens**: 500

## Example Use Cases

### Medication Reminders
```
Input: "Remind me to take my blood pressure medication every morning at 7:30am"
Output: Daily reminder at 7:30 AM with appropriate title and message
```

### Recurring Tasks
```
Input: "Pay credit card bill on the 15th of every month at 10am"
Output: Monthly reminder on the 15th at 10:00 AM
```

### Family Events
```
Input: "Call grandma every Sunday afternoon at 3pm"
Output: Weekly reminder every Sunday at 3:00 PM
```

### Exercise Routines
```
Input: "Go to the gym every weekday at 6am"
Output: Weekday reminder (Monday-Friday) at 6:00 AM
```

## Error Handling

### Common Errors
- **Invalid API Key**: Check OPENROUTER_API_KEY environment variable
- **Parsing Failures**: AI couldn't understand the input - try being more specific
- **Invalid Cron**: Generated cron expression is malformed - fallback to manual entry
- **Network Issues**: OpenRouter API unavailable - retry or use manual form

### Fallback Behavior
- If AI parsing fails, users can still use the traditional manual form
- Parsed data auto-fills the manual form for easy editing
- Clear error messages guide users to successful input

## Testing

### Manual Testing
Use the test script to verify AI functionality:
```bash
python test_ai_integration.py
```

### Example Test Cases
The test script includes various scenarios:
- Daily medication reminders
- Weekly family calls
- Monthly bill payments
- Weekday exercise routines
- Specific date appointments

## Security Considerations

- **API Key Protection**: Store OpenRouter API key securely
- **Input Validation**: All AI-generated data is validated before database storage
- **Rate Limiting**: Consider implementing rate limits for AI endpoints
- **User Privacy**: Natural language inputs are sent to OpenRouter for processing

## Future Enhancements

### Potential Improvements
- **Multi-language Support**: Support for languages other than English
- **Learning from Corrections**: Improve AI based on user edits
- **Batch Processing**: Create multiple reminders from a single input
- **Voice Input**: Integration with speech-to-text for voice commands
- **Smart Suggestions**: Suggest common reminder patterns

### Model Upgrades
- **Better Models**: Upgrade to more capable models as they become available
- **Local Processing**: Consider local AI models for privacy
- **Custom Training**: Fine-tune models on reminder-specific data

## Troubleshooting

### Common Issues

1. **"AI parsing failed" error**
   - Check internet connection
   - Verify OpenRouter API key is valid
   - Try simpler, more specific language

2. **Unexpected cron expressions**
   - AI interpretation may differ from intent
   - Use the preview feature to verify before creating
   - Edit manually using the traditional form

3. **Low confidence scores**
   - Input may be ambiguous
   - Try being more specific about time and frequency
   - Use examples from this documentation as templates

### Support
For issues with the AI integration:
1. Check the test script output for API connectivity
2. Verify environment variables are set correctly
3. Review the natural language input for clarity
4. Use the manual form as a fallback option