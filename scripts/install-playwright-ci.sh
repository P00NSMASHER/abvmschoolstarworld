#!/usr/bin/env bash
set -Eeuo pipefail

readonly MAX_TIMEOUT_SECONDS=360

timeout_seconds="${PLAYWRIGHT_INSTALL_TIMEOUT_SECONDS:-300}"
if ! [[ "$timeout_seconds" =~ ^[1-9][0-9]*$ ]] || (( timeout_seconds > MAX_TIMEOUT_SECONDS )); then
  echo "::error title=Invalid Playwright bootstrap timeout::PLAYWRIGHT_INSTALL_TIMEOUT_SECONDS must be between 1 and $MAX_TIMEOUT_SECONDS." >&2
  exit 64
fi

probe_timeout_seconds=60
if (( timeout_seconds < probe_timeout_seconds )); then
  probe_timeout_seconds="$timeout_seconds"
fi

probe_script='const {chromium,webkit}=require("@playwright/test");(async()=>{for(const browserType of [chromium,webkit]){const browser=await browserType.launch({headless:true});await browser.close();}})().catch(error=>{console.error(error?.stack||error);process.exit(1);});'
last_status=0

run_bounded() {
  local label="$1"
  shift
  echo "::group::$label (bounded to ${timeout_seconds}s)"
  set +e
  timeout --signal=TERM --kill-after=15s "${timeout_seconds}s" "$@"
  last_status=$?
  set -e
  echo "::endgroup::"
  return "$last_status"
}

probe_browsers() {
  echo "::group::Launch cached Chromium and WebKit (bounded to ${probe_timeout_seconds}s)"
  set +e
  timeout --signal=TERM --kill-after=5s "${probe_timeout_seconds}s" node -e "$probe_script"
  last_status=$?
  set -e
  echo "::endgroup::"
  return "$last_status"
}

# The workflow restores version-pinned browser binaries before this script.
# First prove that those exact browsers can launch on the hosted runner. This
# avoids a redundant 364 MB apt transaction when the runner already has the
# required shared libraries. Full browser QA still runs in the next workflow
# step, so a successful smoke probe never substitutes for acceptance.
if run_bounded "Prepare cached Playwright browser binaries" npx playwright install chromium webkit; then
  if probe_browsers; then
    echo "Cached Playwright Chromium/WebKit browsers and runtime dependencies are ready."
    exit 0
  fi
  echo "::warning title=Playwright dependency fallback::Cached browsers could not launch; attempting one bounded OS-dependency installation." >&2
else
  echo "::warning title=Playwright cache fallback::Cached browser preparation failed with exit status $last_status; attempting one bounded OS-dependency installation." >&2
fi

# Use exactly one dependency-install fallback. If it times out, do not start a
# second apt process while the timed-out child may still own dpkg's lock.
if ! run_bounded "Install Playwright OS dependencies and browsers" npx playwright install --with-deps chromium webkit; then
  if (( last_status == 124 )); then
    echo "::error title=Playwright bootstrap timeout::OS dependency/browser setup timed out after ${timeout_seconds}s; no overlapping apt retry was started and browser QA was not run." >&2
  else
    echo "::error title=Playwright bootstrap failure::OS dependency/browser setup failed with exit status $last_status; browser QA was not run." >&2
  fi
  exit "$last_status"
fi

if ! probe_browsers; then
  echo "::error title=Playwright launch failure::Chromium/WebKit still could not launch after dependency setup; browser QA was not run." >&2
  exit "$last_status"
fi

echo "Playwright Chromium/WebKit browsers and OS dependencies are ready after the bounded fallback."
