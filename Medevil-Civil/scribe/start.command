#!/bin/bash
# Double-click this file to open The Scribe.
cd "$(dirname "$0")" || exit 1

PORT=4800

# Reuse the server if it's already up, otherwise start one.
if ! curl -s -o /dev/null "http://localhost:$PORT/"; then
  python3 -m http.server "$PORT" >/dev/null 2>&1 &
  sleep 1
fi

# Speech-to-text needs Chrome or Edge; Safari won't do it.
if [ -d "/Applications/Google Chrome.app" ]; then
  open -a "Google Chrome" "http://localhost:$PORT/"
elif [ -d "/Applications/Microsoft Edge.app" ]; then
  open -a "Microsoft Edge" "http://localhost:$PORT/"
else
  echo "Install Google Chrome or Microsoft Edge — Safari can't turn speech into text."
  open "http://localhost:$PORT/"
fi

echo "The Scribe is running at http://localhost:$PORT/"
echo "Close this window when you're done."
