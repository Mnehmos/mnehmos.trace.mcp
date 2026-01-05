# Python aiohttp library HTTP client samples
# For testing traceUsage() in PythonASTParser

import aiohttp
from aiohttp import ClientSession

# ============================================================================
# Basic aiohttp ClientSession patterns
# ============================================================================

async def get_users():
    """Simple GET request with context manager."""
    async with aiohttp.ClientSession() as session:
        async with session.get("https://api.example.com/users") as response:
            users = await response.json()
            return users

async def get_user(user_id: int):
    """GET request with path parameter."""
    async with aiohttp.ClientSession() as session:
        async with session.get(f"https://api.example.com/users/{user_id}") as response:
            user = await response.json()
            return user

async def create_user(name: str, email: str):
    """POST request with JSON body."""
    async with aiohttp.ClientSession() as session:
        async with session.post(
            "https://api.example.com/users",
            json={"name": name, "email": email}
        ) as response:
            created = await response.json()
            return created

async def update_user(user_id: int, data: dict):
    """PUT request."""
    async with aiohttp.ClientSession() as session:
        async with session.put(
            f"https://api.example.com/users/{user_id}",
            json=data
        ) as response:
            updated = await response.json()
            return updated

async def patch_user(user_id: int, updates: dict):
    """PATCH request."""
    async with aiohttp.ClientSession() as session:
        async with session.patch(
            f"https://api.example.com/users/{user_id}",
            json=updates
        ) as response:
            result = await response.json()
            return result

async def delete_user(user_id: int):
    """DELETE request."""
    async with aiohttp.ClientSession() as session:
        async with session.delete(f"https://api.example.com/users/{user_id}") as response:
            return response.status == 204

async def head_request():
    """HEAD request."""
    async with aiohttp.ClientSession() as session:
        async with session.head("https://api.example.com/health") as response:
            return response.status

async def options_request():
    """OPTIONS request."""
    async with aiohttp.ClientSession() as session:
        async with session.options("https://api.example.com/api") as response:
            return response.headers

# ============================================================================
# Response property access patterns
# ============================================================================

async def access_json():
    """Accessing .json() method."""
    async with aiohttp.ClientSession() as session:
        async with session.get("https://api.example.com/data") as response:
            data = await response.json()
            return data

async def access_text():
    """Accessing .text() method (note: aiohttp uses method, not property)."""
    async with aiohttp.ClientSession() as session:
        async with session.get("https://api.example.com/page") as response:
            text = await response.text()
            return text

async def access_status():
    """Accessing .status property."""
    async with aiohttp.ClientSession() as session:
        async with session.get("https://api.example.com/check") as response:
            status = response.status
            return status

async def access_content():
    """Accessing .read() method for bytes."""
    async with aiohttp.ClientSession() as session:
        async with session.get("https://api.example.com/file") as response:
            content = await response.read()
            return content

async def access_headers():
    """Accessing .headers property."""
    async with aiohttp.ClientSession() as session:
        async with session.get("https://api.example.com/info") as response:
            headers = response.headers
            content_type = response.headers.get("Content-Type")
            return content_type

async def access_ok():
    """Accessing .ok property."""
    async with aiohttp.ClientSession() as session:
        async with session.get("https://api.example.com/status") as response:
            if response.ok:
                return await response.json()
            return None

async def multiple_properties():
    """Multiple property accesses."""
    async with aiohttp.ClientSession() as session:
        async with session.get("https://api.example.com/multi") as response:
            status = response.status
            headers = response.headers
            if response.ok:
                data = await response.json()
                return {"status": status, "data": data}
            else:
                text = await response.text()
                return {"status": status, "error": text}

# ============================================================================
# Session with base_url and headers
# ============================================================================

async def session_with_config():
    """Session with base URL and headers."""
    async with aiohttp.ClientSession(
        base_url="https://api.example.com",
        headers={"Authorization": "Bearer token123"}
    ) as session:
        async with session.get("/users") as response:
            users = await response.json()
        
        async with session.post("/users", json={"name": "Test"}) as response:
            created = await response.json()
        
        return users, created

async def reuse_session():
    """Reuse session for multiple requests."""
    async with aiohttp.ClientSession() as session:
        # First request
        async with session.get("https://api.example.com/items") as response:
            items = await response.json()
        
        # Second request
        async with session.get("https://api.example.com/categories") as response:
            categories = await response.json()
        
        # Third request with POST
        async with session.post(
            "https://api.example.com/items",
            json={"name": "New Item"}
        ) as response:
            new_item = await response.json()
        
        return items, categories, new_item

# ============================================================================
# Alternative session creation patterns
# ============================================================================

async def named_session():
    """Named session variable."""
    session = aiohttp.ClientSession()
    try:
        async with session.get("https://api.example.com/data") as response:
            data = await response.json()
            return data
    finally:
        await session.close()

async def imported_session():
    """Using imported ClientSession."""
    async with ClientSession() as session:
        async with session.get("https://api.example.com/users") as response:
            return await response.json()

async def session_variable():
    """Session stored in variable."""
    client = ClientSession(base_url="https://api.example.com")
    try:
        async with client.get("/endpoint") as resp:
            data = await resp.json()
        async with client.post("/endpoint", json={"key": "value"}) as resp:
            result = await resp.json()
        return data, result
    finally:
        await client.close()

# ============================================================================
# URL patterns
# ============================================================================

async def query_params():
    """Request with query parameters."""
    async with aiohttp.ClientSession() as session:
        async with session.get(
            "https://api.example.com/search",
            params={"q": "test", "page": 1, "limit": 10}
        ) as response:
            results = await response.json()
            return results

async def full_url_query():
    """Full URL with query string."""
    async with aiohttp.ClientSession() as session:
        async with session.get(
            "https://api.example.com/items?category=books&sort=price"
        ) as response:
            items = await response.json()
            return items

async def path_segments():
    """Path with multiple segments."""
    org_id = "org-123"
    team_id = "team-456"
    async with aiohttp.ClientSession() as session:
        async with session.get(
            f"https://api.example.com/orgs/{org_id}/teams/{team_id}/members"
        ) as response:
            members = await response.json()
            return members

# ============================================================================
# Request with custom headers
# ============================================================================

async def custom_headers():
    """Request with custom headers."""
    async with aiohttp.ClientSession() as session:
        async with session.get(
            "https://api.example.com/secure",
            headers={
                "Authorization": "Bearer token",
                "X-Custom-Header": "value",
                "Accept": "application/json"
            }
        ) as response:
            return await response.json()

# ============================================================================
# Request with timeout
# ============================================================================

async def with_timeout():
    """Request with timeout."""
    timeout = aiohttp.ClientTimeout(total=30)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        async with session.get("https://api.example.com/slow") as response:
            return await response.json()

# ============================================================================
# Error handling
# ============================================================================

async def with_error_handling():
    """Request with error handling."""
    async with aiohttp.ClientSession() as session:
        try:
            async with session.get("https://api.example.com/risky") as response:
                response.raise_for_status()
                return await response.json()
        except aiohttp.ClientResponseError as e:
            print(f"HTTP error: {e.status}")
            return None
        except aiohttp.ClientError as e:
            print(f"Client error: {e}")
            return None

# ============================================================================
# Form data and file upload
# ============================================================================

async def post_form_data():
    """POST with form data."""
    async with aiohttp.ClientSession() as session:
        data = aiohttp.FormData()
        data.add_field("name", "John")
        data.add_field("email", "john@example.com")
        
        async with session.post(
            "https://api.example.com/form",
            data=data
        ) as response:
            return await response.json()
