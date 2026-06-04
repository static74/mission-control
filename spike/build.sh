#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

# Embed the Info.plist into the binary so TCC sees the usage string.
# -sectcreate is a linker flag, so each token is passed through swiftc with -Xlinker.
swiftc calendar-spike.swift \
  -o calendar-spike \
  -framework EventKit -framework Foundation \
  -Xlinker -sectcreate -Xlinker __TEXT -Xlinker __info_plist -Xlinker Info.plist

# Sign with the SAME stable identity the shipped helper uses (Task 0.1), so the TCC grant
# earned here transfers to production. Ad-hoc signing would key the grant to a throwaway
# hash and the gate would mean nothing.
IDENTITY="${MC_SIGN_IDENTITY:-MissionControl}"
codesign --force --sign "$IDENTITY" --identifier com.shane.missioncontrol.calendar-helper calendar-spike

echo "Built + signed ./calendar-spike with identity '$IDENTITY'"
