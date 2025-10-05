#!/usr/bin/env python3
"""
Test script for AI integration functionality
"""
import os
import sys
import asyncio
from pathlib import Path

# Add the api directory to the path
api_dir = Path(__file__).parent / "api"
sys.path.insert(0, str(api_dir))

from api.app.ai_service import parse_natural_language_reminder, validate_and_enhance_reminder

async def test_ai_parsing():
    """Test the AI parsing functionality"""
    
    # Test cases
    test_cases = [
        "Remind me to take my medication every day at 8am",
        "Call family member every Sunday at 2pm",
        "Pay rent on the 1st of every month at 9am",
        "Exercise every weekday at 6:30am",
        "Doctor appointment next Tuesday at 3pm"
    ]
    
    print("🤖 Testing AI-powered reminder parsing...")
    print("=" * 50)
    
    for i, test_input in enumerate(test_cases, 1):
        print(f"\n{i}. Testing: '{test_input}'")
        print("-" * 40)
        
        try:
            # Parse with AI
            parsed = parse_natural_language_reminder(test_input, "America/Vancouver")
            
            # Validate and enhance
            enhanced = validate_and_enhance_reminder(parsed)
            
            # Display results
            print(f"✅ Title: {enhanced['title']}")
            print(f"📝 Body: {enhanced.get('body', 'None')}")
            print(f"⏰ Cron: {enhanced['cron']}")
            print(f"📅 Schedule: {enhanced['schedule_description']}")
            print(f"🎯 Confidence: {enhanced['confidence']}")
            if enhanced.get('next_execution'):
                print(f"⏭️  Next run: {enhanced['next_execution']}")
            
        except Exception as e:
            print(f"❌ Error: {e}")
    
    print("\n" + "=" * 50)
    print("✨ AI integration test completed!")

if __name__ == "__main__":
    # Check if OpenRouter API key is set
    if not os.getenv("OPENROUTER_API_KEY"):
        print("❌ OPENROUTER_API_KEY environment variable not set!")
        print("Please set it in your .env file or export it:")
        print("export OPENROUTER_API_KEY='your-api-key-here'")
        sys.exit(1)
    
    # Run the test
    asyncio.run(test_ai_parsing())