from collections.abc import Mapping

from dotenv import load_dotenv
from flask import Flask

from app.api import api_blueprint
from app.config import load_settings


def create_app(config_overrides: Mapping[str, object] | None = None) -> Flask:
    load_dotenv()
    app = Flask(__name__)
    app.config.from_mapping(load_settings())
    if config_overrides:
        app.config.update(config_overrides)
    app.register_blueprint(api_blueprint)
    return app
