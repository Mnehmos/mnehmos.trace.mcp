"""
Flask Application Sample Fixtures
Used for testing Python AST parser's Flask route detection capabilities.
"""

from typing import Optional, List, Dict, Union
from flask import Flask, request, jsonify, abort, g
from functools import wraps

app = Flask(__name__)


# =============================================================================
# Basic GET Routes
# =============================================================================

@app.route("/")
def index():
    """Home page."""
    return "Welcome"


@app.route("/health")
def health_check():
    """Health check endpoint."""
    return jsonify({"status": "healthy"})


@app.route("/users")
def list_users():
    """List all users."""
    return jsonify([])


@app.route("/users/<int:user_id>")
def get_user(user_id: int):
    """Get a specific user by ID."""
    return jsonify({"id": user_id})


@app.route("/users/<int:user_id>/posts/<int:post_id>")
def get_user_post(user_id: int, post_id: int):
    """Get a specific post for a user."""
    return jsonify({"user_id": user_id, "post_id": post_id})


# =============================================================================
# URL Converters
# =============================================================================

@app.route("/items/<string:item_name>")
def get_item_by_name(item_name: str):
    """Get item by string name."""
    return jsonify({"name": item_name})


@app.route("/products/<float:price>")
def get_products_by_price(price: float):
    """Get products by price (float converter)."""
    return jsonify({"price": price})


@app.route("/files/<path:filepath>")
def get_file(filepath: str):
    """Get file by path (catches slashes)."""
    return jsonify({"path": filepath})


@app.route("/uuids/<uuid:item_uuid>")
def get_by_uuid(item_uuid):
    """Get by UUID."""
    return jsonify({"uuid": str(item_uuid)})


# =============================================================================
# POST Routes
# =============================================================================

@app.route("/users", methods=["POST"])
def create_user():
    """Create a new user."""
    data = request.get_json()
    return jsonify(data), 201


@app.route("/users/<int:user_id>/posts", methods=["POST"])
def create_post(user_id: int):
    """Create a post for a user."""
    data = request.get_json()
    return jsonify({"user_id": user_id, **data}), 201


# =============================================================================
# PUT Routes
# =============================================================================

@app.route("/users/<int:user_id>", methods=["PUT"])
def update_user(user_id: int):
    """Update a user."""
    data = request.get_json()
    return jsonify({"id": user_id, **data})


# =============================================================================
# PATCH Routes
# =============================================================================

@app.route("/users/<int:user_id>", methods=["PATCH"])
def partial_update_user(user_id: int):
    """Partially update a user."""
    data = request.get_json()
    return jsonify({"id": user_id, **data})


# =============================================================================
# DELETE Routes
# =============================================================================

@app.route("/users/<int:user_id>", methods=["DELETE"])
def delete_user(user_id: int):
    """Delete a user."""
    return "", 204


# =============================================================================
# Multiple Methods on Single Route
# =============================================================================

@app.route("/resources/<int:resource_id>", methods=["GET", "PUT", "DELETE"])
def resource_handler(resource_id: int):
    """Handle multiple methods for a resource."""
    if request.method == "GET":
        return jsonify({"id": resource_id})
    elif request.method == "PUT":
        return jsonify({"id": resource_id, "updated": True})
    elif request.method == "DELETE":
        return "", 204


@app.route("/items", methods=["GET", "POST"])
def items_handler():
    """Handle GET and POST for items."""
    if request.method == "GET":
        return jsonify([])
    elif request.method == "POST":
        return jsonify(request.get_json()), 201


# =============================================================================
# Routes with Decorators
# =============================================================================

def require_auth(f):
    """Authentication decorator."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth = request.headers.get("Authorization")
        if not auth:
            abort(401)
        return f(*args, **kwargs)
    return decorated_function


@app.route("/protected")
@require_auth
def protected_endpoint():
    """Protected endpoint requiring authentication."""
    return jsonify({"message": "Secret data"})


@app.route("/admin/users")
@require_auth
def admin_list_users():
    """Admin endpoint to list users."""
    return jsonify([])


# =============================================================================
# Routes with Custom Response Types
# =============================================================================

@app.route("/download/<string:filename>")
def download_file(filename: str):
    """Download a file."""
    # Returns file response
    pass


@app.route("/render/<string:template_name>")
def render_template_route(template_name: str):
    """Render a template."""
    # Returns rendered HTML
    pass


# =============================================================================
# Error Handlers (not routes but related)
# =============================================================================

@app.errorhandler(404)
def not_found(error):
    """404 error handler."""
    return jsonify({"error": "Not found"}), 404


@app.errorhandler(500)
def internal_error(error):
    """500 error handler."""
    return jsonify({"error": "Internal server error"}), 500


# =============================================================================
# Before/After Request Handlers
# =============================================================================

@app.before_request
def before_request_handler():
    """Execute before each request."""
    g.start_time = None


@app.after_request
def after_request_handler(response):
    """Execute after each request."""
    return response


# =============================================================================
# Routes without Type Hints (legacy style)
# =============================================================================

@app.route("/legacy/<id>")
def legacy_endpoint(id):
    """Legacy endpoint without type hints."""
    return jsonify({"id": id})


@app.route("/legacy/complex/<category>/<item>")
def legacy_complex_endpoint(category, item):
    """Legacy endpoint with multiple params."""
    return jsonify({"category": category, "item": item})
