# Python httpx library HTTP client samples
# For testing traceUsage() in PythonASTParser

import httpx
from httpx import AsyncClient, Client

# ============================================================================
# Synchronous httpx.* function calls
# ============================================================================

# Simple GET request
response = httpx.get("https://api.example.com/users")
users = response.json()

# GET with path parameter
user_id = 456
response = httpx.get(f"https://api.example.com/users/{user_id}")
user = response.json()

# POST request with JSON body
response = httpx.post(
    "https://api.example.com/users",
    json={"name": "Jane", "email": "jane@example.com"}
)
created = response.json()

# PUT request
response = httpx.put(
    f"https://api.example.com/users/{user_id}",
    json={"name": "Jane Updated"}
)

# PATCH request
response = httpx.patch(
    f"https://api.example.com/users/{user_id}",
    json={"status": "active"}
)

# DELETE request
response = httpx.delete(f"https://api.example.com/users/{user_id}")

# HEAD request
response = httpx.head("https://api.example.com/health")

# OPTIONS request
response = httpx.options("https://api.example.com/api")

# ============================================================================
# Response property access patterns
# ============================================================================

# Accessing .json() method
response = httpx.get("https://api.example.com/data")
data = response.json()

# Accessing .text property
response = httpx.get("https://api.example.com/page")
text = response.text

# Accessing .status_code property
response = httpx.get("https://api.example.com/check")
code = response.status_code

# Accessing .content property (bytes)
response = httpx.get("https://api.example.com/file")
content = response.content

# Accessing .headers property
response = httpx.get("https://api.example.com/info")
headers = response.headers
etag = response.headers.get("ETag")

# Accessing .is_success property (httpx-specific)
response = httpx.get("https://api.example.com/status")
if response.is_success:
    print("OK!")

# Accessing .is_error property
response = httpx.get("https://api.example.com/error")
if response.is_error:
    print(f"Error: {response.status_code}")

# Multiple properties
response = httpx.get("https://api.example.com/multi")
print(f"Status: {response.status_code}, Success: {response.is_success}")
data = response.json()

# ============================================================================
# Synchronous Client usage
# ============================================================================

# Create client with base_url
client = httpx.Client(base_url="https://api.example.com")

response = client.get("/users")
users = response.json()

response = client.post("/users", json={"name": "Test"})

client.close()

# Client as context manager
with httpx.Client(base_url="https://api.example.com") as client:
    response = client.get("/items")
    items = response.json()
    
    response = client.post("/items", json={"name": "Item"})
    new_item = response.json()

# Named client variable
api_client = Client(
    base_url="https://api.example.com",
    headers={"Authorization": "Bearer token"}
)
response = api_client.get("/protected")
data = response.json()
api_client.close()

# ============================================================================
# Async httpx patterns (with async/await)
# ============================================================================

async def fetch_users():
    """Async GET request."""
    response = await httpx.AsyncClient().get("https://api.example.com/users")
    return response.json()

async def create_user(name: str, email: str):
    """Async POST request."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.example.com/users",
            json={"name": name, "email": email}
        )
        return response.json()

async def update_user(user_id: int, data: dict):
    """Async PUT request."""
    async with httpx.AsyncClient(base_url="https://api.example.com") as client:
        response = await client.put(f"/users/{user_id}", json=data)
        if response.is_success:
            return response.json()
        return None

async def delete_user(user_id: int):
    """Async DELETE request."""
    async with AsyncClient() as client:
        response = await client.delete(f"https://api.example.com/users/{user_id}")
        return response.status_code == 204

async def complex_operation():
    """Multiple async requests."""
    async with httpx.AsyncClient(base_url="https://api.example.com") as client:
        # Get list
        response = await client.get("/items")
        items = response.json()
        
        # Create new
        response = await client.post("/items", json={"name": "New"})
        new_item = response.json()
        
        # Update first
        if items:
            item_id = items[0]["id"]
            response = await client.patch(f"/items/{item_id}", json={"status": "processed"})
            updated = response.json()
            
        return items, new_item

# ============================================================================
# URL patterns
# ============================================================================

# Query parameters as dict
response = httpx.get(
    "https://api.example.com/search",
    params={"query": "test", "limit": 20}
)
results = response.json()

# Full URL with query string
response = httpx.get("https://api.example.com/filter?status=active&page=1")

# Path segments
org = "acme"
project = "main"
response = httpx.get(f"https://api.example.com/orgs/{org}/projects/{project}/tasks")
tasks = response.json()

# ============================================================================
# Request with headers
# ============================================================================

response = httpx.get(
    "https://api.example.com/secure",
    headers={
        "Authorization": "Bearer token123",
        "Accept": "application/json",
        "X-Request-ID": "req-001"
    }
)

# ============================================================================
# Request with timeout
# ============================================================================

response = httpx.get(
    "https://api.example.com/slow",
    timeout=60.0
)

# ============================================================================
# Error handling
# ============================================================================

try:
    response = httpx.get("https://api.example.com/risky")
    response.raise_for_status()
    data = response.json()
except httpx.HTTPStatusError as e:
    print(f"HTTP error: {e.response.status_code}")
except httpx.RequestError as e:
    print(f"Request failed: {e}")
