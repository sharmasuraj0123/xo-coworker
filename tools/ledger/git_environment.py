import os
import subprocess
from pathlib import Path
from tempfile import TemporaryDirectory


def run_git(args, **options):
    with TemporaryDirectory(prefix="xo-git-home-") as home:
        env = {key: value for key, value in os.environ.items() if not key.upper().startswith("GIT_")}
        env.update(HOME=home, XDG_CONFIG_HOME=home, GIT_CONFIG_GLOBAL=str(Path(home) / "gitconfig"),
                   GIT_CONFIG_NOSYSTEM="1")
        return subprocess.run(["git", *args], env=env, **options)
