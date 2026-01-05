"""
Flask Blueprint Sample Fixtures
Used for testing Python AST parser's Flask Blueprint detection with url_prefix.
"""

from typing import Optional, List, Dict
from flask import Blueprint, request, jsonify, abort

# =============================================================================
# Blueprint with URL Prefix
# =============================================================================

users_bp = Blueprint("users", __name__, url_prefix="/api/users")


@users_bp.route("")
def list_users():
    """List all users."""
    return jsonify([])


@users_bp.route("/<int:user_id>")
def get_user(user_id: int):
    """Get a specific user."""
    return jsonify({"id": user_id})


@users_bp.route("", methods=["POST"])
def create_user():
    """Create a new user."""
    data = request.get_json()
    return jsonify(data), 201


@users_bp.route("/<int:user_id>", methods=["PUT"])
def update_user(user_id: int):
    """Update a user."""
    data = request.get_json()
    return jsonify({"id": user_id, **data})


@users_bp.route("/<int:user_id>", methods=["DELETE"])
def delete_user(user_id: int):
    """Delete a user."""
    return "", 204


# =============================================================================
# Second Blueprint (different prefix)
# =============================================================================

products_bp = Blueprint("products", __name__, url_prefix="/api/products")


@products_bp.route("")
def list_products():
    """List all products."""
    return jsonify([])


@products_bp.route("/<int:product_id>")
def get_product(product_id: int):
    """Get a specific product."""
    return jsonify({"id": product_id})


@products_bp.route("", methods=["POST"])
def create_product():
    """Create a new product."""
    data = request.get_json()
    return jsonify(data), 201


@products_bp.route("/<int:product_id>/variants")
def list_variants(product_id: int):
    """List variants for a product."""
    return jsonify([])


@products_bp.route("/<int:product_id>/variants/<int:variant_id>")
def get_variant(product_id: int, variant_id: int):
    """Get a specific variant."""
    return jsonify({"product_id": product_id, "variant_id": variant_id})


# =============================================================================
# Blueprint without URL Prefix
# =============================================================================

misc_bp = Blueprint("misc", __name__)


@misc_bp.route("/health")
def health():
    """Health check endpoint."""
    return jsonify({"status": "ok"})


@misc_bp.route("/version")
def version():
    """Version endpoint."""
    return jsonify({"version": "1.0.0"})


# =============================================================================
# Blueprint with URL Converters
# =============================================================================

files_bp = Blueprint("files", __name__, url_prefix="/api/files")


@files_bp.route("/<path:filepath>")
def get_file(filepath: str):
    """Get file by path."""
    return jsonify({"path": filepath})


@files_bp.route("/<uuid:file_uuid>")
def get_file_by_uuid(file_uuid):
    """Get file by UUID."""
    return jsonify({"uuid": str(file_uuid)})


@files_bp.route("/<string:category>/<int:file_id>")
def get_categorized_file(category: str, file_id: int):
    """Get file by category and ID."""
    return jsonify({"category": category, "file_id": file_id})


# =============================================================================
# Blueprint with Multiple Methods
# =============================================================================

resources_bp = Blueprint("resources", __name__, url_prefix="/api/resources")


@resources_bp.route("/<int:resource_id>", methods=["GET", "PUT", "DELETE"])
def resource_handler(resource_id: int):
    """Handle multiple methods for a resource."""
    if request.method == "GET":
        return jsonify({"id": resource_id})
    elif request.method == "PUT":
        data = request.get_json()
        return jsonify({"id": resource_id, **data})
    elif request.method == "DELETE":
        return "", 204


@resources_bp.route("", methods=["GET", "POST"])
def resources_collection():
    """Handle collection operations."""
    if request.method == "GET":
        return jsonify([])
    elif request.method == "POST":
        data = request.get_json()
        return jsonify(data), 201


# =============================================================================
# Admin Blueprint with Nested Structure
# =============================================================================

admin_bp = Blueprint("admin", __name__, url_prefix="/admin")


@admin_bp.route("/dashboard")
def admin_dashboard():
    """Admin dashboard."""
    return jsonify({"page": "dashboard"})


@admin_bp.route("/users")
def admin_list_users():
    """Admin: list all users."""
    return jsonify([])


@admin_bp.route("/users/<int:user_id>/ban", methods=["POST"])
def admin_ban_user(user_id: int):
    """Admin: ban a user."""
    return jsonify({"user_id": user_id, "banned": True})


@admin_bp.route("/settings", methods=["GET", "PUT"])
def admin_settings():
    """Admin settings."""
    if request.method == "GET":
        return jsonify({})
    else:
        data = request.get_json()
        return jsonify(data)


# =============================================================================
# Blueprint with before/after request handlers
# =============================================================================

api_bp = Blueprint("api", __name__, url_prefix="/api/v2")


@api_bp.before_request
def before_api_request():
    """Execute before each API request."""
    pass


@api_bp.after_request
def after_api_request(response):
    """Execute after each API request."""
    return response


@api_bp.route("/data")
def get_data():
    """Get API data."""
    return jsonify({"data": []})


@api_bp.route("/data/<string:data_type>")
def get_typed_data(data_type: str):
    """Get typed data."""
    return jsonify({"type": data_type, "data": []})


# =============================================================================
# Blueprint Error Handlers
# =============================================================================

@users_bp.errorhandler(404)
def users_not_found(error):
    """User not found handler."""
    return jsonify({"error": "User not found"}), 404


@users_bp.errorhandler(400)
def users_bad_request(error):
    """Bad request handler for users blueprint."""
    return jsonify({"error": "Bad request"}), 400
