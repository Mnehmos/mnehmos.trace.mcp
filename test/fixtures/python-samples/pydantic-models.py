"""
Pydantic Model Sample Fixtures
Used for testing Python AST parser's Pydantic BaseModel extraction capabilities.
"""

from typing import (
    Optional, List, Dict, Union, Any, Set, Tuple,
    FrozenSet, Sequence, Mapping, Literal, Callable,
    TypeVar, Generic
)
from datetime import datetime, date, time, timedelta
from decimal import Decimal
from uuid import UUID
from enum import Enum, IntEnum
from pydantic import (
    BaseModel, Field, validator, root_validator,
    constr, conint, confloat, conlist,
    EmailStr, HttpUrl, SecretStr
)


# =============================================================================
# Basic Models
# =============================================================================

class SimpleModel(BaseModel):
    """A simple model with basic fields."""
    name: str
    age: int
    active: bool


class ModelWithDefaults(BaseModel):
    """Model demonstrating default values."""
    name: str
    age: int = 0
    active: bool = True
    tags: List[str] = []
    metadata: Dict[str, Any] = {}


class ModelWithOptional(BaseModel):
    """Model with optional fields."""
    required_field: str
    optional_str: Optional[str] = None
    optional_int: Optional[int] = None
    optional_list: Optional[List[str]] = None


# =============================================================================
# Models with Field() Constraints
# =============================================================================

class ConstrainedModel(BaseModel):
    """Model with Field constraints."""
    name: str = Field(..., min_length=1, max_length=100)
    age: int = Field(..., ge=0, le=150)
    score: float = Field(0.0, ge=0.0, le=100.0)
    email: str = Field(..., pattern=r"^[\w\.-]+@[\w\.-]+\.\w+$")
    tags: List[str] = Field(default_factory=list, max_items=10)


class ModelWithDescriptions(BaseModel):
    """Model with field descriptions for documentation."""
    id: int = Field(..., description="Unique identifier")
    name: str = Field(..., description="Display name of the item")
    status: str = Field("pending", description="Current status")
    priority: int = Field(
        0,
        ge=0,
        le=10,
        description="Priority level (0-10)"
    )


# =============================================================================
# Nested Models
# =============================================================================

class Address(BaseModel):
    """Address model."""
    street: str
    city: str
    state: str
    postal_code: str
    country: str = "US"


class ContactInfo(BaseModel):
    """Contact information."""
    email: str
    phone: Optional[str] = None
    address: Optional[Address] = None


class Person(BaseModel):
    """Person with nested models."""
    id: int
    name: str
    contact: ContactInfo
    addresses: List[Address] = []


class Organization(BaseModel):
    """Organization with deeply nested models."""
    id: int
    name: str
    headquarters: Address
    branches: List[Address] = []
    employees: List[Person] = []
    metadata: Dict[str, Any] = {}


# =============================================================================
# Inheritance
# =============================================================================

class BaseEntity(BaseModel):
    """Base entity with common fields."""
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None


class User(BaseEntity):
    """User extending BaseEntity."""
    username: str
    email: str
    is_active: bool = True


class AdminUser(User):
    """Admin user with additional permissions."""
    permissions: List[str] = []
    admin_level: int = 1


# =============================================================================
# Models with Enums
# =============================================================================

class Status(str, Enum):
    """Status enum."""
    PENDING = "pending"
    ACTIVE = "active"
    INACTIVE = "inactive"
    DELETED = "deleted"


class Priority(IntEnum):
    """Priority enum."""
    LOW = 1
    MEDIUM = 2
    HIGH = 3
    CRITICAL = 4


class Task(BaseModel):
    """Task with enum fields."""
    id: int
    title: str
    status: Status = Status.PENDING
    priority: Priority = Priority.MEDIUM


# =============================================================================
# Models with Special Types
# =============================================================================

class SpecialTypesModel(BaseModel):
    """Model with special Pydantic types."""
    email: EmailStr
    website: HttpUrl
    password: SecretStr
    uuid: UUID
    created: datetime
    birth_date: date
    start_time: time
    duration: timedelta
    amount: Decimal


# =============================================================================
# Models with Constrained Types
# =============================================================================

class ConstrainedTypesModel(BaseModel):
    """Model with constrained types."""
    short_name: constr(min_length=1, max_length=50)
    positive_int: conint(gt=0)
    percentage: confloat(ge=0.0, le=100.0)
    limited_list: conlist(str, min_items=1, max_items=5)


# =============================================================================
# Models with Union Types
# =============================================================================

class UnionTypesModel(BaseModel):
    """Model with union types."""
    id: Union[int, str]
    value: Union[str, int, float]
    data: Union[List[str], Dict[str, Any]]
    optional_union: Optional[Union[int, str]] = None


# =============================================================================
# Models with Literal Types
# =============================================================================

class LiteralModel(BaseModel):
    """Model with Literal types."""
    status: Literal["pending", "active", "inactive"]
    priority: Literal[1, 2, 3]
    mode: Literal["read", "write", "append"]


# =============================================================================
# Models with Complex Collections
# =============================================================================

class ComplexCollectionsModel(BaseModel):
    """Model with complex collection types."""
    string_list: List[str]
    int_set: Set[int]
    string_tuple: Tuple[str, str, str]
    frozen_tags: FrozenSet[str]
    nested_list: List[List[int]]
    dict_of_lists: Dict[str, List[int]]
    list_of_dicts: List[Dict[str, Any]]
    mapping: Mapping[str, int]
    sequence: Sequence[str]


# =============================================================================
# Models with Validators
# =============================================================================

class ModelWithValidators(BaseModel):
    """Model with field validators."""
    name: str
    email: str
    age: int
    
    @validator("name")
    def name_must_not_be_empty(cls, v):
        if not v.strip():
            raise ValueError("Name cannot be empty")
        return v.strip()
    
    @validator("email")
    def email_must_be_valid(cls, v):
        if "@" not in v:
            raise ValueError("Invalid email")
        return v.lower()
    
    @validator("age")
    def age_must_be_positive(cls, v):
        if v < 0:
            raise ValueError("Age must be non-negative")
        return v
    
    @root_validator
    def check_consistency(cls, values):
        """Root validator checking multiple fields."""
        return values


# =============================================================================
# Generic Models
# =============================================================================

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    """Generic paginated response."""
    items: List[T]
    total: int
    page: int
    page_size: int
    has_more: bool


class ApiResponse(BaseModel, Generic[T]):
    """Generic API response wrapper."""
    success: bool
    data: Optional[T] = None
    error: Optional[str] = None


# =============================================================================
# Models with Config
# =============================================================================

class ModelWithConfig(BaseModel):
    """Model with Config class."""
    snake_case_field: str
    camelCaseField: str
    
    class Config:
        """Pydantic configuration."""
        allow_population_by_field_name = True
        use_enum_values = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class ImmutableModel(BaseModel):
    """Immutable model (frozen)."""
    id: int
    name: str
    
    class Config:
        frozen = True


class OrmModel(BaseModel):
    """ORM-compatible model."""
    id: int
    name: str
    
    class Config:
        orm_mode = True


# =============================================================================
# Request/Response Models (Common API Pattern)
# =============================================================================

class CreateUserRequest(BaseModel):
    """Request model for user creation."""
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: Optional[str] = None


class UpdateUserRequest(BaseModel):
    """Request model for user update."""
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    is_active: Optional[bool] = None


class UserResponse(BaseModel):
    """Response model for user data."""
    id: int
    username: str
    email: str
    full_name: Optional[str] = None
    is_active: bool = True
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        orm_mode = True


class UserListResponse(BaseModel):
    """Response model for user list."""
    users: List[UserResponse]
    total: int
    page: int
    page_size: int


# =============================================================================
# Discriminated Union Models
# =============================================================================

class DogModel(BaseModel):
    """Dog model."""
    pet_type: Literal["dog"]
    name: str
    breed: str


class CatModel(BaseModel):
    """Cat model."""
    pet_type: Literal["cat"]
    name: str
    indoor: bool = True


class BirdModel(BaseModel):
    """Bird model."""
    pet_type: Literal["bird"]
    name: str
    can_fly: bool = True


# Discriminated union (Python 3.10+ style annotation also shown)
PetUnion = Union[DogModel, CatModel, BirdModel]


class PetOwner(BaseModel):
    """Owner with discriminated union pet."""
    name: str
    pet: Union[DogModel, CatModel, BirdModel]
