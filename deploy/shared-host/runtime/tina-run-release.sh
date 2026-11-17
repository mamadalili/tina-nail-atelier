#!/bin/sh
# Private hosting launcher: support system and CloudLinux Python without changing account settings.
umask 077
cd "$(dirname "$0")" || exit 1
{
    date -u
    for salon_python in /usr/bin/python3 /usr/local/bin/python3 \
        /opt/alt/python313/bin/python3 /opt/alt/python312/bin/python3 \
        /opt/alt/python311/bin/python3 /opt/alt/python310/bin/python3 \
        /opt/alt/python39/bin/python3 /opt/alt/python38/bin/python3 \
        /opt/alt/python3*/bin/python3 /usr/bin/python3.*; do
        if [ -x "$salon_python" ]; then
            "$salon_python" --version
            TINA_RELEASE_CURL=1 "$salon_python" sync_release.py
            salon_result=$?
            echo "exit=$salon_result"
            exit "$salon_result"
        fi
    done
    echo 'Python 3 is unavailable in the standard and CloudLinux runtime paths.'
    exit 127
} > release-cron.log 2>&1
