from __future__ import annotations

import base64
import socket
import threading
import time
from pathlib import Path

import webview

from app import app


main_window = None


def get_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def run_server(port: int) -> None:
    app.run(host="127.0.0.1", port=port, debug=False, use_reloader=False)


def wait_for_server(port: int, timeout: float = 10.0) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(0.5)
            if sock.connect_ex(("127.0.0.1", port)) == 0:
                return
        time.sleep(0.1)
    raise RuntimeError(f"Local server did not start on port {port} in time.")


class DesktopApi:
    def save_pdf(self, encoded_pdf: str, suggested_name: str) -> dict[str, str | bool]:
        if main_window is None:
            return {"saved": False, "cancelled": True, "path": ""}

        save_target = main_window.create_file_dialog(
            webview.SAVE_DIALOG,
            directory=str(Path.home() / "Downloads"),
            save_filename=suggested_name,
            file_types=("PDF Files (*.pdf)",),
        )
        if not save_target:
            return {"saved": False, "cancelled": True, "path": ""}

        save_path = Path(save_target if isinstance(save_target, str) else save_target[0])
        save_path.write_bytes(base64.b64decode(encoded_pdf))
        return {"saved": True, "cancelled": False, "path": str(save_path)}


if __name__ == "__main__":
    port = get_free_port()
    server_thread = threading.Thread(target=run_server, args=(port,), daemon=True)
    server_thread.start()
    wait_for_server(port)
    main_window = webview.create_window(
        "Sagar Loom Tex",
        f"http://127.0.0.1:{port}",
        width=1280,
        height=840,
        js_api=DesktopApi(),
    )
    webview.start()
