#!/usr/bin/env bash
set -Eeuo pipefail

readonly MAX_ATTEMPTS=2
readonly MAX_TIMEOUT_SECONDS=360

attempts="${PLAYWRIGHT_INSTALL_ATTEMPTS:-2}"
timeout_seconds="${PLAYWRIGHT_INSTALL_TIMEOUT_SECONDS:-300}"

if ! [[ "$attempts" =~ ^[1-9][0-9]*$ ]] || (( attempts > MAX_ATTEMPTS )); then
  echo "::error title=Invalid Playwright bootstrap retry budget::PLAYWRIGHT_INSTALL_ATTEMPTS must be between 1 and $MAX_ATTEMPTS." >&2
  exit 64
fi
if ! [[ "$timeout_seconds" =~ ^[1-9][0-9]*$ ]] || (( timeout_seconds > MAX_TIMEOUT_SECONDS )); then
  echo "::error title=Invalid Playwright bootstrap timeout::PLAYWRIGHT_INSTALL_TIMEOUT_SECONDS must be between 1 and $MAX_TIMEOUT_SECONDS." >&2
  exit 64
fi

for ((attempt=1; attempt<=attempts; attempt++)); do
  echo "::group::Playwright bootstrap attempt $attempt/$attempts (bounded to ${timeout_seconds}s)"
  set +e
  timeout --signal=TERM --kill-after=15s "${timeout_seconds}s" \
    npx playwright install --with-deps chromium webkit
  status=$?
  set -e
  echo "::endgroup::"

  if (( status == 0 )); then
    echo "Playwright Chromium/WebKit browsers and OS dependencies are ready."
    exit 0
  fi

  if (( status == 124 )); then
    reason="timed out after ${timeout_seconds}s"
  else
    reason="failed with exit status $status"
  fi

  if (( attempt < attempts )); then
    echo "::warning title=Playwright bootstrap retry::Attempt $attempt/$attempts $reason; retrying once inside the fixed workflow budget." >&2
    continue
  fi

  if (( status == 124 )); then
    echo "::error title=Playwright bootstrap timeout::OS dependency/browser setup $reason on both bounded attempts; browser QA was not run." >&2
  else
    echo "::error title=Playwright bootstrap failure::OS dependency/browser setup $reason after $attempts bounded attempts; browser QA was not run." >&2
  fi
  exit "$status"
done
