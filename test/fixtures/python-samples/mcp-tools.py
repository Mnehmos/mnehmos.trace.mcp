"""
MCP Tool Sample Fixtures
Used for testing Python AST parser's MCP tool detection (backward compatibility).
"""

from typing import Optional, List, Dict, Union, Any
from mcp import Tool
from mcp.server import Server
from pydantic import BaseModel, Field


# =============================================================================
# Server Instance
# =============================================================================

mcp = Server("sample-mcp-server")
server = Server("alternate-server")


# =============================================================================
# Basic MCP Tool Decorators
# =============================================================================

@mcp.tool()
def simple_tool(query: str) -> str:
    """Simple tool that processes a query."""
    return f"Result: {query}"


@mcp.tool()
async def async_simple_tool(input: str) -> str:
    """Async simple tool."""
    return input


@mcp.tool()
def tool_with_multiple_params(
    query: str,
    limit: int,
    offset: int = 0
) -> List[str]:
    """Tool with multiple parameters."""
    return []


# =============================================================================
# MCP Tools with Pydantic Models
# =============================================================================

class SearchInput(BaseModel):
    """Input model for search."""
    query: str = Field(..., description="Search query string")
    filters: Optional[Dict[str, str]] = None
    max_results: int = Field(10, ge=1, le=100)


class SearchResult(BaseModel):
    """Result model for search."""
    id: str
    title: str
    score: float
    metadata: Optional[Dict[str, Any]] = None


@mcp.tool()
def search_data(input: SearchInput) -> List[SearchResult]:
    """Search for data using structured input."""
    pass


@mcp.tool()
async def async_search(input: SearchInput) -> List[SearchResult]:
    """Async search tool."""
    pass


# =============================================================================
# MCP Tools with Complex Types
# =============================================================================

@mcp.tool()
def process_batch(
    items: List[str],
    options: Dict[str, Any]
) -> Dict[str, Union[str, int, bool]]:
    """Process a batch of items."""
    return {}


@mcp.tool()
def get_optional_data(
    id: str,
    include_metadata: bool = False
) -> Optional[SearchResult]:
    """Get data that may not exist."""
    return None


@mcp.tool()
def union_return_type(id: str) -> Union[SearchResult, Dict[str, str]]:
    """Tool that returns union type."""
    return {}


# =============================================================================
# Alternate Server Tools (@server.tool())
# =============================================================================

@server.tool()
def alternate_tool(input: str) -> str:
    """Tool on alternate server instance."""
    return input


@server.tool()
async def async_alternate_tool(
    data: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """Async tool on alternate server."""
    return []


# =============================================================================
# MCP Tools with Detailed Docstrings
# =============================================================================

@mcp.tool()
def tool_with_detailed_docstring(
    query: str,
    filters: Optional[Dict[str, str]] = None,
    limit: int = 10
) -> List[SearchResult]:
    """
    Search for items matching the query.
    
    This tool performs a comprehensive search across all indexed data
    and returns matching results sorted by relevance score.
    
    Args:
        query: The search query string. Supports boolean operators.
        filters: Optional dictionary of field filters to apply.
        limit: Maximum number of results to return (default: 10).
    
    Returns:
        List of SearchResult objects containing matched items.
    
    Raises:
        ValueError: If query is empty or invalid.
        RuntimeError: If search service is unavailable.
    
    Example:
        >>> results = tool_with_detailed_docstring("python", limit=5)
        >>> print(len(results))
        5
    """
    pass


@mcp.tool()
async def async_with_docstring(input: str) -> Dict[str, Any]:
    """
    Process input asynchronously.
    
    Performs async processing on the provided input string.
    
    Args:
        input: The input string to process.
    
    Returns:
        Dictionary containing processing results.
    """
    return {}


# =============================================================================
# MCP Tools without Type Hints (edge case)
# =============================================================================

@mcp.tool()
def tool_no_types(query, limit=10):
    """Tool without type hints (legacy style)."""
    pass


@mcp.tool()
def tool_partial_types(query: str, limit=10):
    """Tool with partial type hints."""
    pass


# =============================================================================
# MCP Tools with Literal Types
# =============================================================================

from typing import Literal


@mcp.tool()
def tool_with_literal(
    action: Literal["create", "update", "delete"],
    resource: str
) -> Dict[str, Any]:
    """Tool using Literal type for constrained values."""
    return {}


@mcp.tool()
def tool_with_literal_union(
    mode: Literal["fast", "slow"],
    format: Literal["json", "xml", "csv"]
) -> str:
    """Tool with multiple Literal parameters."""
    return ""


# =============================================================================
# MCP Tools with Default Values
# =============================================================================

@mcp.tool()
def tool_with_defaults(
    required_param: str,
    optional_str: str = "default",
    optional_int: int = 42,
    optional_bool: bool = True,
    optional_list: List[str] = [],
    optional_dict: Dict[str, str] = {}
) -> Dict[str, Any]:
    """Tool demonstrating various default value types."""
    return {}


@mcp.tool()
def tool_with_none_default(
    required: str,
    optional: Optional[str] = None
) -> str:
    """Tool with None as default."""
    return ""


# =============================================================================
# Nested Pydantic Models for MCP Tools
# =============================================================================

class Address(BaseModel):
    """Address model."""
    street: str
    city: str
    country: str
    postal_code: Optional[str] = None


class Person(BaseModel):
    """Person model with nested address."""
    name: str
    email: str
    age: Optional[int] = None
    addresses: List[Address] = []


class PersonResponse(BaseModel):
    """Response containing person data."""
    person: Person
    created_at: str
    updated_at: Optional[str] = None


@mcp.tool()
def create_person(person: Person) -> PersonResponse:
    """Create a person with nested address data."""
    pass


@mcp.tool()
def update_person(
    person_id: str,
    updates: Dict[str, Any]
) -> PersonResponse:
    """Update a person's data."""
    pass


# =============================================================================
# MCP Tools with Error Cases (for testing error handling)
# =============================================================================

@mcp.tool()
def tool_that_raises(input: str) -> str:
    """Tool that raises an exception."""
    raise ValueError("Test error")


@mcp.tool()
async def async_tool_that_raises(input: str) -> str:
    """Async tool that raises an exception."""
    raise RuntimeError("Async test error")
