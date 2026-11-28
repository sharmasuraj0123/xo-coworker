#!/usr/bin/env sh
# Run in the foreground by default, or use --background, --status and --stop to manage a detached server.
cd "$(dirname "$0")" || exit 1
PIDFILE=.server.pid
running() { [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; }

case "${1:-}" in
  --background|-d)
    if running; then echo "already running (pid $(cat "$PIDFILE"))"; exit 0; fi
    nohup python3 serve.py >> .server.log 2>&1 &
    echo $! > "$PIDFILE"
    sleep 0.5
    if running; then echo "started (pid $(cat "$PIDFILE")) on http://127.0.0.1:${PORT:-5180}/"; else echo "failed to start; see .server.log"; exit 1; fi ;;
  --stop)
    if running; then kill "$(cat "$PIDFILE")" && rm -f "$PIDFILE" && echo "stopped"; else echo "not running"; rm -f "$PIDFILE"; fi ;;
  --status)
    if running; then echo "running (pid $(cat "$PIDFILE"))"; else echo "not running"; exit 1; fi ;;
  "")
    exec python3 serve.py ;;
  *)
    echo "usage: $0 [--background|--stop|--status]"; exit 2 ;;
esac
