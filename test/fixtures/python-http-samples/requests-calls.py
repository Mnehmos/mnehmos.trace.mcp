# Python requests library HTTP client samples
# For testing traceUsage() in PythonASTParser

import requests
from requests import Session

# ============================================================================
# Basic requests.* function calls
# ============================================================================

# Simple GET request with string URL
response = requests.get("https://api.example.com/users")
users = response.json()

# GET with path parameter in f-string
user_id = 123
response = requests.get(f"https://api.example.com/users/{user_id}")
user = response.json()

# POST request with JSON body
response = requests.post(
    "https://api.example.com/users",
    json={"name": "John", "email": "john@example.com"}
)
created = response.json()

# PUT request
response = requests.put(
    f"https://api.example.com/users/{user_id}",
    json={"name": "John Updated"}
)

# PATCH request
response = requests.patch(
    f"https://api.example.com/users/{user_id}",
    json={"email": "newemail@example.com"}
)

# DELETE request
response = requests.delete(f"https://api.example.com/users/{user_id}")

# HEAD request
response = requests.head("https://api.example.com/users")
headers = response.headers

# OPTIONS request
response = requests.options("https://api.example.com/users")

# ============================================================================
# Response property access patterns
# ============================================================================

# Accessing .json() method
response = requests.get("https://api.example.com/posts")
data = response.json()

# Accessing .text property
response = requests.get("https://api.example.com/html")
html = response.text

# Accessing .status_code property
response = requests.get("https://api.example.com/status")
status = response.status_code

# Accessing .content property (bytes)
response = requests.get("https://api.example.com/binary")
content = response.content

# Accessing .headers property
response = requests.get("https://api.example.com/info")
content_type = response.headers["Content-Type"]

# Accessing .ok property
response = requests.get("https://api.example.com/check")
if response.ok:
    print("Success!")

# Multiple property accesses on same response
response = requests.get("https://api.example.com/multi")
if response.ok:
    data = response.json()
    print(f"Status: {response.status_code}")
else:
    error = response.text

# ============================================================================
# Session-based requests
# ============================================================================

# Create session and use it
session = requests.Session()
session.headers.update({"Authorization": "Bearer token123"})

# Session GET
response = session.get("https://api.example.com/protected/users")
protected_users = response.json()

# Session POST
response = session.post(
    "https://api.example.com/protected/data",
    json={"key": "value"}
)

# Session with named variable
api_session = Session()
api_session.auth = ("user", "pass")

response = api_session.get("https://api.example.com/auth/profile")
profile = response.json()

# ============================================================================
# URL patterns
# ============================================================================

# Constant URL
BASE_URL = "https://api.example.com"
response = requests.get(f"{BASE_URL}/endpoint")

# Query parameters as dict
response = requests.get(
    "https://api.example.com/search",
    params={"q": "python", "page": 1, "limit": 10}
)
search_results = response.json()

# Query parameters in URL string
response = requests.get("https://api.example.com/items?category=books&sort=price")

# Path with multiple segments
org_id = "org-123"
team_id = "team-456"
response = requests.get(f"https://api.example.com/orgs/{org_id}/teams/{team_id}/members")

# ============================================================================
# Request with headers
# ============================================================================

response = requests.get(
    "https://api.example.com/secure",
    headers={
        "Authorization": "Bearer token",
        "X-Custom-Header": "custom-value",
        "Accept": "application/json"
    }
)

# ============================================================================
# Request with timeout and other options
# ============================================================================

response = requests.get(
    "https://api.example.com/slow",
    timeout=30,
    verify=True
)

# ============================================================================
# Error handling patterns
# ============================================================================

try:
    response = requests.get("https://api.example.com/might-fail")
    response.raise_for_status()
    data = response.json()
except requests.exceptions.HTTPError as e:
    print(f"HTTP error: {e}")
except requests.exceptions.RequestException as e:
    print(f"Request failed: {e}")
