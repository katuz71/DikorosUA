import os
from pathlib import Path
from dotenv import load_dotenv

# Get the .env file path in the same directory as this script
env_path = Path(__file__).parent / '.env'

# Prompt user for OpenAI API key
api_key = input("Paste your OpenAI Key: ").strip()

# Write the key to .env file
try:
    with open(env_path, 'w', encoding='utf-8') as f:
        f.write(f"OPENAI_API_KEY={api_key}\n")
    
    # Test reading it back using dotenv
    load_dotenv(dotenv_path=env_path)
    loaded_key = os.getenv("OPENAI_API_KEY")
    
    if loaded_key and loaded_key == api_key:
        print("SUCCESS: Key saved and verified")
    else:
        print("ERROR: Key could not be verified")
        
except Exception as e:
    print(f"ERROR: {str(e)}")

