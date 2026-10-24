from flask import Blueprint

from app.api.health import health_blueprint
from app.api.providers import providers_blueprint

api_blueprint = Blueprint("api", __name__, url_prefix="/api")
api_blueprint.register_blueprint(health_blueprint)
api_blueprint.register_blueprint(providers_blueprint)
