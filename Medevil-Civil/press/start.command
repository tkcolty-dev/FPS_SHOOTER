#!/bin/bash
# Double-click to open The Press.
cd "$(dirname "$0")" || exit 1

PORT=4802

if ! command -v node >/dev/null 2>&1; then
  echo "Node is needed for printing straight to the printer. Install it from nodejs.org."
  exit 1
fi

# Reuse a running copy, otherwise start one.
if ! curl -s -o /dev/null "http://localhost:$PORT/"; then
  node server.js >/tmp/press.log 2>&1 &
  sleep 1.5
fi

if [ -d "/Applications/Google Chrome.app" ]; then
  open -a "Google Chrome" "http://localhost:$PORT/"
else
  open "http://localhost:$PORT/"
fi

echo "The Press is running at http://localhost:$PORT/"
echo "Close this window when you're done."
