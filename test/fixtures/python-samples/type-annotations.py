"""
Type Annotation Sample Fixtures
Used for testing Python AST parser's type annotation resolution capabilities.
"""

from typing import (
    Optional, List, Dict, Union, Any, Set, Tuple, FrozenSet,
    Sequence, Mapping, MutableMapping, MutableSequence,
    Callable, Awaitable, Coroutine, Generator, AsyncGenerator,
    Iterator, AsyncIterator, Iterable, AsyncIterable,
    TypeVar, Generic, ClassVar, Final, Literal,
    Type, NewType, NamedTuple, TypedDict,
    Protocol, runtime_checkable, overload
)
from collections.abc import Collection
from datetime import datetime, date, time, timedelta
from decimal import Decimal
from uuid import UUID
from pathlib import Path
from typing_extensions import Annotated, TypeAlias


# =============================================================================
# Primitive Types
# =============================================================================

def primitive_str(value: str) -> str:
    """String type."""
    return value


def primitive_int(value: int) -> int:
    """Integer type."""
    return value


def primitive_float(value: float) -> float:
    """Float type."""
    return value


def primitive_bool(value: bool) -> bool:
    """Boolean type."""
    return value


def primitive_bytes(value: bytes) -> bytes:
    """Bytes type."""
    return value


def primitive_none() -> None:
    """None return type."""
    pass


# =============================================================================
# Optional Types
# =============================================================================

def optional_str(value: Optional[str]) -> Optional[str]:
    """Optional string."""
    return value


def optional_int(value: Optional[int] = None) -> Optional[int]:
    """Optional int with default."""
    return value


def optional_complex(value: Optional[List[str]] = None) -> Optional[Dict[str, int]]:
    """Optional complex types."""
    return None


# =============================================================================
# Union Types
# =============================================================================

def union_basic(value: Union[str, int]) -> Union[str, int]:
    """Basic union type."""
    return value


def union_multiple(value: Union[str, int, float, bool]) -> Union[str, int]:
    """Union with multiple types."""
    return str(value)


def union_with_none(value: Union[str, None]) -> Union[str, None]:
    """Union with None (equivalent to Optional)."""
    return value


def union_complex(
    value: Union[List[str], Dict[str, int], Set[float]]
) -> Union[str, int]:
    """Union with complex types."""
    return 0


# =============================================================================
# Python 3.10+ Union Syntax (| operator)
# =============================================================================

def union_pipe(value: str | int) -> str | int:
    """Python 3.10+ union syntax."""
    return value


def optional_pipe(value: str | None) -> str | None:
    """Python 3.10+ optional syntax."""
    return value


def multi_pipe(value: str | int | float | None) -> str | None:
    """Multiple types with pipe syntax."""
    return str(value) if value else None


# =============================================================================
# List Types
# =============================================================================

def list_str(items: List[str]) -> List[str]:
    """List of strings."""
    return items


def list_int(items: List[int]) -> List[int]:
    """List of integers."""
    return items


def list_complex(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """List of dictionaries."""
    return items


def list_nested(items: List[List[int]]) -> List[List[str]]:
    """Nested lists."""
    return [[str(x) for x in inner] for inner in items]


def list_union(items: List[Union[str, int]]) -> List[str]:
    """List with union element type."""
    return [str(x) for x in items]


# =============================================================================
# Dict Types
# =============================================================================

def dict_str_str(data: Dict[str, str]) -> Dict[str, str]:
    """Dict with string keys and values."""
    return data


def dict_str_any(data: Dict[str, Any]) -> Dict[str, Any]:
    """Dict with string keys and any values."""
    return data


def dict_complex_value(
    data: Dict[str, List[int]]
) -> Dict[str, List[int]]:
    """Dict with complex value type."""
    return data


def dict_nested(
    data: Dict[str, Dict[str, int]]
) -> Dict[str, Dict[str, int]]:
    """Nested dictionaries."""
    return data


# =============================================================================
# Set and Tuple Types
# =============================================================================

def set_type(items: Set[str]) -> Set[str]:
    """Set of strings."""
    return items


def frozenset_type(items: FrozenSet[int]) -> FrozenSet[int]:
    """FrozenSet of integers."""
    return items


def tuple_fixed(data: Tuple[str, int, float]) -> Tuple[str, int, float]:
    """Fixed-length tuple with specific types."""
    return data


def tuple_variable(data: Tuple[int, ...]) -> Tuple[int, ...]:
    """Variable-length tuple of integers."""
    return data


def tuple_single(data: Tuple[str]) -> Tuple[str]:
    """Single-element tuple."""
    return data


# =============================================================================
# Sequence and Mapping Types
# =============================================================================

def sequence_type(items: Sequence[str]) -> Sequence[str]:
    """Sequence type (read-only list-like)."""
    return items


def mutable_sequence(items: MutableSequence[int]) -> MutableSequence[int]:
    """Mutable sequence type."""
    return items


def mapping_type(data: Mapping[str, int]) -> Mapping[str, int]:
    """Mapping type (read-only dict-like)."""
    return data


def mutable_mapping(data: MutableMapping[str, str]) -> MutableMapping[str, str]:
    """Mutable mapping type."""
    return data


def collection_type(items: Collection[str]) -> Collection[str]:
    """Collection type."""
    return items


# =============================================================================
# Literal Types
# =============================================================================

def literal_string(mode: Literal["read", "write"]) -> Literal["success", "error"]:
    """Literal string type."""
    return "success"


def literal_int(level: Literal[1, 2, 3]) -> Literal[0, 1]:
    """Literal integer type."""
    return 1


def literal_bool(flag: Literal[True, False]) -> Literal[True]:
    """Literal boolean type."""
    return True


def literal_mixed(value: Literal["a", 1, True]) -> Literal["a", "b"]:
    """Literal mixed types."""
    return "a"


# =============================================================================
# Callable Types
# =============================================================================

def callable_simple(func: Callable[[int], str]) -> str:
    """Simple callable type."""
    return func(0)


def callable_multi_args(
    func: Callable[[str, int, float], bool]
) -> bool:
    """Callable with multiple arguments."""
    return func("", 0, 0.0)


def callable_no_args(func: Callable[[], int]) -> int:
    """Callable with no arguments."""
    return func()


def callable_any_args(func: Callable[..., str]) -> str:
    """Callable with any arguments."""
    return func()


def callable_returns_callable(
    factory: Callable[[int], Callable[[str], bool]]
) -> Callable[[str], bool]:
    """Callable returning a callable."""
    return factory(0)


# =============================================================================
# Async Types
# =============================================================================

async def async_return(value: str) -> str:
    """Async function with return type."""
    return value


async def async_optional(value: str) -> Optional[str]:
    """Async function with optional return."""
    return value


def awaitable_type(coro: Awaitable[int]) -> Awaitable[int]:
    """Awaitable type."""
    return coro


def coroutine_type(
    coro: Coroutine[Any, Any, str]
) -> Coroutine[Any, Any, str]:
    """Coroutine type."""
    return coro


async def async_generator_type(
    items: List[int]
) -> AsyncGenerator[int, None]:
    """Async generator type."""
    for item in items:
        yield item


async def async_iterator_type(
    items: AsyncIterator[str]
) -> AsyncIterator[str]:
    """Async iterator type."""
    return items


# =============================================================================
# Generator and Iterator Types
# =============================================================================

def generator_type(n: int) -> Generator[int, None, str]:
    """Generator type with yield and return."""
    for i in range(n):
        yield i
    return "done"


def iterator_type(items: Iterator[str]) -> Iterator[str]:
    """Iterator type."""
    return items


def iterable_type(items: Iterable[int]) -> Iterable[int]:
    """Iterable type."""
    return items


# =============================================================================
# TypeVar and Generic Types
# =============================================================================

T = TypeVar("T")
K = TypeVar("K")
V = TypeVar("V")


def generic_identity(value: T) -> T:
    """Generic identity function."""
    return value


def generic_list(items: List[T]) -> List[T]:
    """Generic list function."""
    return items


def generic_dict(data: Dict[K, V]) -> Dict[K, V]:
    """Generic dict function."""
    return data


class GenericContainer(Generic[T]):
    """Generic container class."""
    
    def __init__(self, value: T) -> None:
        self.value = value
    
    def get(self) -> T:
        return self.value
    
    def set(self, value: T) -> None:
        self.value = value


class GenericPair(Generic[K, V]):
    """Generic pair class with two type parameters."""
    
    def __init__(self, key: K, value: V) -> None:
        self.key = key
        self.value = value
    
    def get_key(self) -> K:
        return self.key
    
    def get_value(self) -> V:
        return self.value


# =============================================================================
# Special Types
# =============================================================================

def type_type(cls: Type[str]) -> Type[int]:
    """Type type (class reference)."""
    return int


def any_type(value: Any) -> Any:
    """Any type."""
    return value


def class_var(value: str) -> ClassVar[str]:
    """ClassVar type."""
    pass


def final_type(value: Final[str]) -> Final[int]:
    """Final type."""
    pass


# =============================================================================
# Standard Library Types
# =============================================================================

def datetime_type(dt: datetime) -> datetime:
    """Datetime type."""
    return dt


def date_type(d: date) -> date:
    """Date type."""
    return d


def time_type(t: time) -> time:
    """Time type."""
    return t


def timedelta_type(td: timedelta) -> timedelta:
    """Timedelta type."""
    return td


def decimal_type(d: Decimal) -> Decimal:
    """Decimal type."""
    return d


def uuid_type(u: UUID) -> UUID:
    """UUID type."""
    return u


def path_type(p: Path) -> Path:
    """Path type."""
    return p


# =============================================================================
# NewType and TypeAlias
# =============================================================================

UserId = NewType("UserId", int)
Email = NewType("Email", str)

# TypeAlias (Python 3.10+)
Vector: TypeAlias = List[float]
Matrix: TypeAlias = List[List[float]]


def newtype_param(user_id: UserId) -> UserId:
    """NewType parameter."""
    return user_id


def typealias_param(vec: Vector) -> Matrix:
    """TypeAlias parameter."""
    return [vec]


# =============================================================================
# NamedTuple
# =============================================================================

class Point(NamedTuple):
    """Point NamedTuple."""
    x: float
    y: float


class Person(NamedTuple):
    """Person NamedTuple with defaults."""
    name: str
    age: int
    email: Optional[str] = None


def namedtuple_param(point: Point) -> Person:
    """NamedTuple parameters."""
    return Person(name="", age=0)


# =============================================================================
# TypedDict
# =============================================================================

class UserDict(TypedDict):
    """User TypedDict."""
    name: str
    age: int
    email: str


class PartialUserDict(TypedDict, total=False):
    """Partial TypedDict (all optional)."""
    name: str
    age: int


class MixedUserDict(TypedDict):
    """Mixed TypedDict with required and optional."""
    name: str  # required
    age: int  # required


def typeddict_param(user: UserDict) -> PartialUserDict:
    """TypedDict parameter."""
    return {"name": user["name"]}


# =============================================================================
# Protocol
# =============================================================================

@runtime_checkable
class Closable(Protocol):
    """Closable protocol."""
    
    def close(self) -> None:
        """Close the resource."""
        ...


class Readable(Protocol):
    """Readable protocol."""
    
    def read(self, n: int = -1) -> str:
        """Read n characters."""
        ...


def protocol_param(resource: Closable) -> None:
    """Protocol parameter."""
    resource.close()


# =============================================================================
# Annotated Types
# =============================================================================

def annotated_type(
    value: Annotated[int, "positive integer"],
    name: Annotated[str, "max length 100"]
) -> Annotated[bool, "success flag"]:
    """Annotated types with metadata."""
    return True


def annotated_complex(
    items: Annotated[List[str], "tags list"]
) -> Annotated[Dict[str, int], "counts"]:
    """Annotated complex types."""
    return {}


# =============================================================================
# Overloaded Functions
# =============================================================================

@overload
def overloaded_func(value: int) -> str: ...

@overload
def overloaded_func(value: str) -> int: ...

def overloaded_func(value: Union[int, str]) -> Union[str, int]:
    """Overloaded function implementation."""
    if isinstance(value, int):
        return str(value)
    return int(value)


# =============================================================================
# Complex Nested Types
# =============================================================================

def deeply_nested(
    data: Dict[str, List[Tuple[int, Optional[Dict[str, Union[str, int]]]]]]
) -> List[Dict[str, Any]]:
    """Deeply nested type annotations."""
    return []


def callback_hell(
    factory: Callable[
        [int],
        Callable[
            [str],
            Callable[
                [float],
                bool
            ]
        ]
    ]
) -> bool:
    """Nested callable types."""
    return factory(0)("")(0.0)
