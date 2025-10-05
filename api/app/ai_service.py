import os
import json
import re
from datetime import datetime, time
from typing import Dict, Any, Optional, Tuple
from openai import OpenAI
from croniter import croniter
import pytz
import logging

# Set up logging
logger = logging.getLogger(__name__)

# Initialize OpenRouter client with error handling
def get_openrouter_client():
    """Get OpenRouter client with proper error handling"""
    from .config import settings
    
    api_key = settings.OPENROUTER_API_KEY or os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise ValueError("OPENROUTER_API_KEY is not configured. Please set it in your environment variables.")
    
    return OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key,
    )


def build_cron_from_structured_data(parsed_data: Dict[str, Any]) -> str:
    """
    Build a cron expression from structured time and recurrence data.
    This is deterministic and doesn't rely on AI to generate the cron string.
    
    Args:
        parsed_data: Dictionary with 'time' and 'recurrence' fields
        
    Returns:
        Valid cron expression string
    """
    time_data = parsed_data.get("time", {})
    recurrence = parsed_data.get("recurrence", {})
    
    # Extract time components
    minute = time_data.get("minute", 0)
    hour = time_data.get("hour", 8)
    
    # Validate time
    if not (0 <= hour <= 23):
        raise ValueError(f"Invalid hour: {hour}. Must be 0-23")
    if not (0 <= minute <= 59):
        raise ValueError(f"Invalid minute: {minute}. Must be 0-59")
    
    # Build cron based on recurrence type
    rec_type = recurrence.get("type", "daily")
    
    if rec_type == "daily":
        if recurrence.get("weekdays_only"):
            # Monday-Friday only
            return f"{minute} {hour} * * 1-5"
        else:
            # Every day
            return f"{minute} {hour} * * *"
    
    elif rec_type == "weekly":
        day_of_week = recurrence.get("day_of_week")
        if day_of_week is None:
            raise ValueError("Weekly recurrence requires day_of_week")
        if isinstance(day_of_week, list):
            dow_str = ",".join(str(d) for d in day_of_week)
            return f"{minute} {hour} * * {dow_str}"
        else:
            return f"{minute} {hour} * * {day_of_week}"
    
    elif rec_type == "monthly":
        day_of_month = recurrence.get("day_of_month", 1)
        return f"{minute} {hour} {day_of_month} * *"
    
    elif rec_type == "yearly":
        day_of_month = recurrence.get("day_of_month", 1)
        month = recurrence.get("month", 1)
        return f"{minute} {hour} {day_of_month} {month} *"
    
    elif rec_type == "once":
        # For one-time reminders, default to daily (user can disable after it fires)
        return f"{minute} {hour} * * *"
    
    else:
        # Default to daily
        return f"{minute} {hour} * * *"


def parse_natural_language_reminder(text: str, user_timezone: str = "America/Vancouver") -> Dict[str, Any]:
    """
    Parse natural language text into structured reminder data using AI.
    AI returns structured data (time, recurrence), then we build the cron expression deterministically.
    
    Args:
        text: Natural language description of the reminder
        user_timezone: User's timezone for scheduling
        
    Returns:
        Dictionary with parsed reminder data including title, body, cron, and metadata
    """
    
    # Get current time in user's timezone for context
    tz = pytz.timezone(user_timezone)
    current_time = datetime.now(tz)
    current_time_str = current_time.strftime("%Y-%m-%d %H:%M %Z")
    
    system_prompt = f"""You are an AI assistant that converts natural language into structured reminder data for a family notification system.

Current time: {current_time_str}
User timezone: {user_timezone}

Your task is to parse the user's natural language input and return a JSON object with the following structure:
{{
    "title": "Brief, clear title for the reminder (max 120 chars)",
    "body": "Optional detailed message (can be null if not needed)",
    "time": {{
        "hour": 8,        // 0-23 in 24-hour format (8=8am, 20=8pm)
        "minute": 0       // 0-59
    }},
    "recurrence": {{
        "type": "daily|weekly|monthly|yearly|once",
        "day_of_week": null,     // 0-6 for weekly (0=Sunday, 1=Monday, etc.) or list like [1,3,5]
        "day_of_month": null,    // 1-31 for monthly
        "month": null,           // 1-12 for yearly
        "weekdays_only": false   // true for Monday-Friday only
    }},
    "confidence": "high|medium|low"
}}

Time parsing rules:
- "8am", "8:00am" → hour=8, minute=0
- "8:15am" → hour=8, minute=15
- "2:30pm", "14:30" → hour=14, minute=30
- "8pm", "8:00pm" → hour=20, minute=0
- "8:15pm" → hour=20, minute=15
- "noon", "12pm" → hour=12, minute=0
- "midnight", "12am" → hour=0, minute=0

Recurrence parsing:
- "every day", "daily" → type="daily"
- "every Monday" → type="weekly", day_of_week=1
- "weekdays" → type="daily", weekdays_only=true
- "every month on the 15th" → type="monthly", day_of_month=15
- "once" or specific date → type="once"

Examples:
1. "remind me to take out trash at 8:15pm" →
   {{"title": "Take out trash", "time": {{"hour": 20, "minute": 15}}, "recurrence": {{"type": "daily"}}, "confidence": "high"}}

2. "call mom every Sunday at 2:30pm" →
   {{"title": "Call mom", "time": {{"hour": 14, "minute": 30}}, "recurrence": {{"type": "weekly", "day_of_week": 0}}, "confidence": "high"}}

3. "team meeting weekdays at 9am" →
   {{"title": "Team meeting", "time": {{"hour": 9, "minute": 0}}, "recurrence": {{"type": "daily", "weekdays_only": true}}, "confidence": "high"}}

Return only valid JSON. If you cannot parse confidently, set confidence to "low" and make reasonable assumptions."""

    user_prompt = f"Parse this reminder request: {text}"
    
    try:
        # Get client with error handling
        client = get_openrouter_client()
        
        logger.info(f"Parsing natural language: {text[:50]}...")
        
        response = client.chat.completions.create(
            model="deepseek/deepseek-chat-v3.1:free",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.1,
            max_tokens=500
        )
        
        # Extract JSON from response
        content = response.choices[0].message.content.strip()
        logger.debug(f"AI response: {content}")
        
        # Try to extract JSON if it's wrapped in markdown or other text
        json_match = re.search(r'\{.*\}', content, re.DOTALL)
        if json_match:
            content = json_match.group()
        
        parsed_data = json.loads(content)
        
        # DEBUG: Log the parsed structured data
        logger.info(f"🔍 DEBUG - AI returned structured data: {parsed_data}")
        
        # Ensure required fields
        if not parsed_data.get("title"):
            logger.error("AI did not generate a title")
            raise ValueError("No title generated by AI")
        
        if "time" not in parsed_data:
            logger.error("AI did not generate time data")
            raise ValueError("No time data generated by AI")
        
        # Build cron expression from structured data
        cron_expression = build_cron_from_structured_data(parsed_data)
        parsed_data["cron"] = cron_expression
        
        logger.info(f"🔍 DEBUG - Built cron expression: {cron_expression}")
        
        # Validate the cron expression
        try:
            croniter(cron_expression)
        except ValueError as e:
            logger.error(f"Invalid cron expression built: {cron_expression} - {e}")
            raise ValueError(f"Invalid cron expression: {e}")
        
        # Truncate title if too long
        if len(parsed_data["title"]) > 120:
            parsed_data["title"] = parsed_data["title"][:117] + "..."
        
        # Generate human-readable schedule description
        parsed_data["schedule_description"] = generate_cron_description(cron_expression)
        
        # Ensure timezone is included in the response
        if "timezone" not in parsed_data:
            parsed_data["timezone"] = user_timezone
        
        logger.info(f"Successfully parsed: {parsed_data['title']} - {cron_expression}")
        return parsed_data
        
    except json.JSONDecodeError as e:
        logger.error(f"JSON parsing error: {e}")
        raise ValueError(f"AI returned invalid JSON format: {e}")
    except Exception as e:
        logger.error(f"AI parsing error: {e}")
        if "api_key" in str(e).lower():
            raise ValueError("OpenRouter API key is invalid or missing")
        elif "rate limit" in str(e).lower():
            raise ValueError("Rate limit exceeded. Please try again in a moment")
        elif "network" in str(e).lower() or "connection" in str(e).lower():
            raise ValueError("Network error connecting to AI service. Please check your internet connection")
        else:
            raise ValueError(f"AI service error: {e}")


def validate_and_enhance_reminder(parsed_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate and enhance the parsed reminder data.
    
    Args:
        parsed_data: Dictionary from parse_natural_language_reminder
        
    Returns:
        Enhanced and validated reminder data
    """
    
    # Validate cron expression
    try:
        cron_iter = croniter(parsed_data["cron"])
        # Get next execution time to verify it's valid
        next_run = cron_iter.get_next(datetime)
        parsed_data["next_execution"] = next_run.isoformat()
    except Exception as e:
        raise ValueError(f"Invalid cron expression: {e}")
    
    # Ensure title is not empty and within limits
    title = parsed_data.get("title", "").strip()
    if not title:
        raise ValueError("Title cannot be empty")
    if len(title) > 120:
        title = title[:117] + "..."
        parsed_data["title"] = title
    
    # Clean up body
    body = parsed_data.get("body")
    if body:
        body = body.strip()
        if not body or body.lower() in ["none", "null", "n/a"]:
            body = None
        parsed_data["body"] = body
    
    # Ensure confidence is valid
    confidence = parsed_data.get("confidence", "medium")
    if confidence not in ["high", "medium", "low"]:
        parsed_data["confidence"] = "medium"
    
    return parsed_data


def generate_cron_description(cron: str) -> str:
    """
    Generate a human-readable description of a cron expression.
    
    Args:
        cron: Cron expression string
        
    Returns:
        Human-readable description
    """
    try:
        parts = cron.split()
        if len(parts) != 5:
            return cron
        
        minute, hour, day, month, dow = parts
        
        # Time part
        if hour == "*":
            time_desc = "every hour"
        else:
            hour_int = int(hour)
            minute_int = int(minute) if minute != "*" else 0
            time_obj = time(hour_int, minute_int)
            time_desc = f"at {time_obj.strftime('%I:%M %p').lower()}"
        
        # Frequency part
        if day == "*" and month == "*" and dow == "*":
            freq_desc = "every day"
        elif day == "*" and month == "*" and dow == "1-5":
            freq_desc = "on weekdays"
        elif day == "*" and month == "*" and dow == "0,6":
            freq_desc = "on weekends"
        elif day == "*" and month == "*" and dow.isdigit():
            days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
            freq_desc = f"every {days[int(dow)]}"
        elif day != "*" and month == "*":
            freq_desc = f"on the {day}{'st' if day.endswith('1') else 'nd' if day.endswith('2') else 'rd' if day.endswith('3') else 'th'} of every month"
        elif day != "*" and month != "*":
            months = ["", "January", "February", "March", "April", "May", "June",
                     "July", "August", "September", "October", "November", "December"]
            freq_desc = f"on {months[int(month)]} {day}"
        else:
            freq_desc = "on a custom schedule"
        
        return f"{freq_desc} {time_desc}".strip()
        
    except Exception:
        return cron