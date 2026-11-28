import fcntl
import os
import re
import shutil
import sys
import tempfile
from pathlib import Path


def publish(stage, version):
    destination = stage.parent
    selected = destination / "current"
    lock = os.open(destination, os.O_RDONLY)
    try:
        fcntl.flock(lock, fcntl.LOCK_EX)
        prior = selected.read_text().splitlines() if selected.exists() else []
        keep = list(dict.fromkeys([version, *prior]))[:2]
        release = destination / version
        if not release.exists():
            stage.rename(release)
        elif not (release / ".build.json").is_file():
            raise ValueError(f"Incomplete existing release {version}")
        with tempfile.NamedTemporaryFile(mode="w", dir=destination, delete=False) as pointer:
            pointer.write("\n".join(keep) + "\n")
        os.replace(pointer.name, selected)
        for path in destination.iterdir():
            if re.fullmatch(r"[0-9a-f]{12}", path.name) and path.name not in keep and (path / ".build.json").is_file():
                shutil.rmtree(path)
        return release
    finally:
        os.close(lock)


if __name__ == "__main__":
    print(publish(Path(sys.argv[1]), sys.argv[2]))
