#!/bin/bash
# Double-click to open The Press.
cd "$(dirname "$0")" || exit 1

PORT=4802

if ! curl -s -o /dev/null "http://localhost:$PORT/"; then
  python3 -m http.server "$PORT" >/dev/null 2>&1 &
  sleep 1
fi

if [ -d "/Applications/Google Chrome.app" ]; then
  open -a "Google Chrome" "http://localhost:$PORT/"
else
  open "http://localhost:$PORT/"
fi

echo "The Press is running at http://localhost:$PORT/"
echo "Close this window when you're done."
