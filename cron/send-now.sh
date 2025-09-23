#!/usr/bin/env bash
set -euo pipefail

topic="https://ntfy.sh/family-alerts"
title="Cron Test Now"
message="Immediate ping triggered at $(date -Is)"

curl -sS -H "Title: ${title}" -d "${message}" "${topic}" >/dev/null
