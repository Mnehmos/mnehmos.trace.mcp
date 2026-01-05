"""
FastAPI Application Sample Fixtures
Used for testing Python AST parser's FastAPI detection capabilities.
"""

from typing import Optional, List, Dict, Union
from fastapi import FastAPI, Query, Path, Body, Header, Depends, HTTPException
from pydantic import BaseModel, Field
from datetime import datetime

app = FastAPI(title="Sample API", version="1.0.0")


# =============================================================================
# Pydantic Models for Request/Response
# =============================================================================

class UserCreate(BaseModel):
    """Request model for creating a user."""
    name: str = Field(..., min_length=1, max_length=100)
    email: str = Field(..., pattern=r"^[\w\.-]+@[\w\.-]+\.\w+$")
    age: Optional[int] = Field(None, ge=0, le=150)
    tags: List[str] = []


class UserResponse(BaseModel):
    """Response model for user data."""
    id: int
    name: str
    email: str
    age: Optional[int] = None
    tags: List[str] = []
    created_at: datetime


class UserUpdate(BaseModel):
    """Request model for updating a user."""
    name: Optional[str] = None
    email: Optional[str] = None
    age: Optional[int] = None


class PaginatedResponse(BaseModel):
    """Generic paginated response."""
    items: List[UserResponse]
    total: int
    page: int
    page_size: int
    has_more: bool


class ErrorResponse(BaseModel):
    """Standard error response."""
    error: str
    code: int
    details: Optional[Dict[str, str]] = None


# =============================================================================
# Basic GET Endpoints
# =============================================================================

@app.get("/users")
async def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    search: Optional[str] = None
) -> List[UserResponse]:
    """List all users with pagination."""
    pass


@app.get("/users/{user_id}")
async def get_user(user_id: int = Path(..., gt=0)) -> UserResponse:
    """Get a specific user by ID."""
    pass


@app.get("/users/{user_id}/posts/{post_id}")
async def get_user_post(
    user_id: int = Path(..., gt=0),
    post_id: int = Path(..., gt=0)
) -> dict:
    """Get a specific post for a user."""
    pass


# =============================================================================
# POST Endpoints
# =============================================================================

@app.post("/users", response_model=UserResponse, status_code=201)
async def create_user(user: UserCreate) -> UserResponse:
    """Create a new user."""
    pass


@app.post("/users/{user_id}/posts")
async def create_user_post(
    user_id: int,
    title: str = Body(...),
    content: str = Body(...),
    tags: List[str] = Body([])
) -> dict:
    """Create a new post for a user."""
    pass


# =============================================================================
# PUT Endpoints
# =============================================================================

@app.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user: UserUpdate
) -> UserResponse:
    """Update an existing user."""
    pass


# =============================================================================
# PATCH Endpoints
# =============================================================================

@app.patch("/users/{user_id}")
async def partial_update_user(
    user_id: int,
    name: Optional[str] = Body(None),
    email: Optional[str] = Body(None)
) -> UserResponse:
    """Partially update a user."""
    pass


# =============================================================================
# DELETE Endpoints
# =============================================================================

@app.delete("/users/{user_id}", status_code=204)
async def delete_user(user_id: int) -> None:
    """Delete a user."""
    pass


# =============================================================================
# Endpoints with Headers and Dependencies
# =============================================================================

async def get_current_user(authorization: str = Header(...)) -> UserResponse:
    """Dependency to get current authenticated user."""
    pass


@app.get("/me", response_model=UserResponse)
async def get_current_user_profile(
    current_user: UserResponse = Depends(get_current_user)
) -> UserResponse:
    """Get the current user's profile."""
    pass


@app.get("/protected")
async def protected_endpoint(
    x_api_key: str = Header(..., alias="X-API-Key"),
    x_request_id: Optional[str] = Header(None, alias="X-Request-ID")
) -> dict:
    """Protected endpoint requiring API key."""
    pass


# =============================================================================
# Endpoints with Complex Types
# =============================================================================

@app.get("/paginated", response_model=PaginatedResponse)
async def get_paginated_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100)
) -> PaginatedResponse:
    """Get paginated list of users."""
    pass


@app.post("/batch")
async def batch_operation(
    user_ids: List[int] = Body(...),
    operation: str = Body(...)
) -> Dict[int, str]:
    """Perform batch operation on users."""
    pass


# =============================================================================
# Error Handling Examples
# =============================================================================

@app.get("/users/{user_id}/verify", responses={
    200: {"model": UserResponse},
    404: {"model": ErrorResponse},
    422: {"model": ErrorResponse}
})
async def verify_user(user_id: int) -> Union[UserResponse, ErrorResponse]:
    """Verify a user exists and return their data or error."""
    pass


# =============================================================================
# Deprecated Endpoints
# =============================================================================

@app.get("/v1/users", deprecated=True, response_model=List[UserResponse])
async def list_users_v1() -> List[UserResponse]:
    """Deprecated: Use /users instead."""
    pass


# =============================================================================
# Endpoints with Tags and Summary
# =============================================================================

@app.get(
    "/admin/users",
    tags=["admin", "users"],
    summary="List all users (admin)",
    description="Admin endpoint to list all users with additional details.",
    response_model=List[UserResponse]
)
async def admin_list_users() -> List[UserResponse]:
    """Admin: List all users."""
    pass


# =============================================================================
# Sync Functions (not async)
# =============================================================================

@app.get("/health")
def health_check() -> dict:
    """Health check endpoint (sync)."""
    return {"status": "healthy"}


@app.get("/version")
def get_version() -> dict:
    """Get API version (sync)."""
    return {"version": "1.0.0"}
