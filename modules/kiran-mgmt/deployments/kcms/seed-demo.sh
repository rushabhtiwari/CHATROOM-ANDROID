#!/bin/bash
# Loads the Kiran demo workspace (users, projects, work items, cycles, modules).
#
#   docker exec -e DEMO_PASSWORD=... kcms kcms-seed-demo
#
# The seeder refuses to run unless DEBUG is on, because it creates users with a known
# password. DEBUG is switched on for this one command only; the server keeps running
# with it off.
set -euo pipefail
cd /app/backend
demo_password="${DEMO_PASSWORD:-}"
# shellcheck disable=SC1091
. /run/kcms-env.sh
export DEMO_PASSWORD="$demo_password"
python manage.py wait_for_migrations
DEBUG=1 python manage.py seed_kcms_demo
# The API caches the instance record (including "has setup been done"), so without
# this the admin console keeps offering first-run setup after the seeder has done it.
python manage.py clear_cache
