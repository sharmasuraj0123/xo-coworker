#!/bin/bash
kill $(cat /tmp/e2e/space.pid) 2>/dev/null; sleep 2
rm -rf /tmp/e2e/state /tmp/e2e/projects && mkdir -p /tmp/e2e/projects/demo /tmp/e2e/state
cd /tmp/e2e/projects/demo && git init -q && printf '# Demo\n\nOne.\nTwo.\n' > notes.md && mkdir src && printf 'const a = 1;\n' > src/app.js && printf 'node_modules/\n' > .gitignore && git add -A && git -c user.email=e2e@x -c user.name=e2e commit -qm init
cd /home/coder/xo-space/.xo/worktrees/thread-cmsg_9ee805292df3450c && (PORT=5292 XO_PROJECTS_ROOT=/tmp/e2e/projects QUIRQ_STATE_ROOT=/tmp/e2e/state setsid nohup /opt/xo-space/venv/bin/python server.py > /tmp/e2e/space.log 2>&1 & echo $! > /tmp/e2e/space.pid)
sleep 12   # no chat made by hand: Space makes the project's chat for its first file event (a8e26a4)
