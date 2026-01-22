#!/usr/bin/env python3
"""
Test script for User Profile and Bonus System API
"""

import requests
import json

BASE_URL = "http://localhost:8001"

def test_user_profile():
    """Test GET /user/{phone} endpoint"""
    print("Testing user profile endpoint...")
    
    # Test with new user (should create new user)
    phone = "380501234567"
    response = requests.get(f"{BASE_URL}/user/{phone}")
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.json()}")
    
    # Test with existing user (should return existing user)
    response2 = requests.get(f"{BASE_URL}/user/{phone}")
    
    print(f"\nSecond call Status Code: {response2.status_code}")
    print(f"Second call Response: {response2.json()}")
    
    return response.json()

def test_user_orders(phone):
    """Test GET /orders/user/{phone} endpoint"""
    print(f"\nTesting user orders endpoint for phone: {phone}")
    
    response = requests.get(f"{BASE_URL}/orders/user/{phone}")
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.json()}")
    
    return response.json()

def main():
    print("=== User Profile and Bonus System API Test ===\n")
    
    try:
        # Test user profile
        user_data = test_user_profile()
        
        # Test user orders
        test_user_orders(user_data['phone'])
        
        print("\n=== Test completed successfully! ===")
        
    except requests.exceptions.ConnectionError:
        print("❌ Error: Could not connect to the server.")
        print("Make sure the FastAPI server is running on http://localhost:8001")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    main()
