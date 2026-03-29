from flaskwebgui import FlaskUI

from app import app


if __name__ == "__main__":
    FlaskUI(server="flask", app=app, port=8000, width=1200, height=800, fullscreen=False).run()
