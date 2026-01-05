"""
FastAPI Router Sample Fixtures
Used for testing Python AST parser's FastAPI router detection with prefix.
"""

from typing import Optional, List
from fastapi import APIRouter, Query, Path, Body, Depends, HTTPException
from pydantic import BaseModel, Field

# =============================================================================
# Router with Prefix
# =============================================================================

router = APIRouter(prefix="/api/v1", tags=["items"])


class Item(BaseModel):
    """Item model."""
    name: str
    description: Optional[str] = None
    price: float = Field(..., gt=0)
    quantity: int = Field(1, ge=0)


class ItemCreate(BaseModel):
    """Request model for creating an item."""
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    price: float = Field(..., gt=0)
    quantity: int = Field(1, ge=0)


class ItemUpdate(BaseModel):
    """Request model for updating an item."""
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = Field(None, gt=0)
    quantity: Optional[int] = Field(None, ge=0)


# =============================================================================
# Router GET Endpoints
# =============================================================================

@router.get("/items")
async def list_items(
    skip: int = 0,
    limit: int = Query(10, ge=1, le=100),
    category: Optional[str] = None
) -> List[Item]:
    """List all items."""
    pass


@router.get("/items/{item_id}")
async def get_item(item_id: int = Path(..., gt=0)) -> Item:
    """Get a specific item by ID."""
    pass


@router.get("/items/{item_id}/variants/{variant_id}")
async def get_item_variant(
    item_id: int = Path(..., gt=0),
    variant_id: str = Path(...)
) -> dict:
    """Get a specific variant of an item."""
    pass


# =============================================================================
# Router POST Endpoints
# =============================================================================

@router.post("/items", response_model=Item, status_code=201)
async def create_item(item: ItemCreate) -> Item:
    """Create a new item."""
    pass


@router.post("/items/{item_id}/duplicate")
async def duplicate_item(item_id: int) -> Item:
    """Duplicate an existing item."""
    pass


# =============================================================================
# Router PUT/PATCH Endpoints
# =============================================================================

@router.put("/items/{item_id}", response_model=Item)
async def replace_item(item_id: int, item: ItemCreate) -> Item:
    """Replace an item entirely."""
    pass


@router.patch("/items/{item_id}", response_model=Item)
async def update_item(item_id: int, item: ItemUpdate) -> Item:
    """Update an item partially."""
    pass


# =============================================================================
# Router DELETE Endpoints
# =============================================================================

@router.delete("/items/{item_id}", status_code=204)
async def delete_item(item_id: int) -> None:
    """Delete an item."""
    pass


# =============================================================================
# Second Router (different prefix)
# =============================================================================

orders_router = APIRouter(prefix="/api/v1/orders", tags=["orders"])


class Order(BaseModel):
    """Order model."""
    id: int
    item_ids: List[int]
    total: float
    status: str


@orders_router.get("")
async def list_orders(status: Optional[str] = None) -> List[Order]:
    """List all orders."""
    pass


@orders_router.get("/{order_id}")
async def get_order(order_id: int) -> Order:
    """Get a specific order."""
    pass


@orders_router.post("", response_model=Order)
async def create_order(item_ids: List[int] = Body(...)) -> Order:
    """Create a new order."""
    pass


@orders_router.patch("/{order_id}/status")
async def update_order_status(
    order_id: int,
    status: str = Body(...)
) -> Order:
    """Update order status."""
    pass


# =============================================================================
# Nested Router Pattern
# =============================================================================

admin_router = APIRouter(prefix="/admin")


@admin_router.get("/stats")
async def get_stats() -> dict:
    """Get admin statistics."""
    pass


@admin_router.delete("/items/{item_id}/force")
async def force_delete_item(item_id: int) -> None:
    """Force delete an item (admin only)."""
    pass


# Include sub-router
router.include_router(admin_router)
