#!/usr/bin/env bash
# Exports an App Store distribution IPA. Does not upload to Apple or publish a release.
set -euo pipefail
cd "$(dirname "$0")/.."
for key in IOS_DISTRIBUTION_CERTIFICATE_BASE64 IOS_DISTRIBUTION_CERTIFICATE_PASSWORD IOS_PROVISIONING_PROFILE_BASE64 IOS_TEAM_ID; do
  if [[ -z "${!key:-}" ]]; then printf 'Missing required signing variable: %s\n' "$key" >&2; exit 1; fi
done
if [[ "$(uname -s)" != Darwin ]]; then printf 'Signed iOS export requires macOS and Xcode.\n' >&2; exit 1; fi
build_temp=$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/hoi-ios-signing.XXXXXX")
keychain_path="$build_temp/signing.keychain-db"
keychain_password=$(openssl rand -hex 24)
profile_path=''
original_keychains=()
while IFS= read -r entry; do original_keychains+=("$entry"); done < <(security list-keychains -d user | python3 -c 'import shlex,sys; print("\n".join(shlex.split(sys.stdin.read())))')
cleanup() {
  security list-keychains -d user -s "${original_keychains[@]}" >/dev/null 2>&1 || true
  security delete-keychain "$keychain_path" >/dev/null 2>&1 || true
  if [[ -n "$profile_path" ]]; then rm -f "$profile_path"; fi
  # mktemp created this dedicated directory; only its exact named files are removed.
  rm -f "$build_temp/distribution.p12" "$build_temp/profile.mobileprovision" "$build_temp/profile.plist" "$build_temp/export-options.plist"
  rmdir "$build_temp" 2>/dev/null || true
}
trap cleanup EXIT
export IOS_SIGNING_TEMP="$build_temp"
python3 - <<'PY'
import base64, os, pathlib
root = pathlib.Path(os.environ['IOS_SIGNING_TEMP'])
for variable, name in [('IOS_DISTRIBUTION_CERTIFICATE_BASE64', 'distribution.p12'), ('IOS_PROVISIONING_PROFILE_BASE64', 'profile.mobileprovision')]:
    (root / name).write_bytes(base64.b64decode(os.environ[variable], validate=True))
PY
security create-keychain -p "$keychain_password" "$keychain_path"
security set-keychain-settings -lut 21600 "$keychain_path"
security unlock-keychain -p "$keychain_password" "$keychain_path"
security list-keychains -d user -s "$keychain_path" "${original_keychains[@]}"
security import "$build_temp/distribution.p12" -P "$IOS_DISTRIBUTION_CERTIFICATE_PASSWORD" -A -t cert -f pkcs12 -k "$keychain_path" >/dev/null
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$keychain_password" "$keychain_path" >/dev/null
security cms -D -i "$build_temp/profile.mobileprovision" > "$build_temp/profile.plist"
profile_uuid=$(python3 - <<'PY'
import os, pathlib, plistlib, datetime
root = pathlib.Path(os.environ['IOS_SIGNING_TEMP'])
profile = plistlib.loads((root / 'profile.plist').read_bytes())
team = os.environ['IOS_TEAM_ID']
if team not in profile.get('TeamIdentifier', []): raise SystemExit('Provisioning profile team does not match IOS_TEAM_ID.')
if profile.get('Entitlements', {}).get('application-identifier') != team + '.com.hoicompany.carddesk': raise SystemExit('Provisioning profile must target com.hoicompany.carddesk.')
if profile.get('ExpirationDate') <= datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None): raise SystemExit('Provisioning profile has expired.')
if profile.get('ProvisionedDevices') or profile.get('ProvisionsAllDevices'): raise SystemExit('Use an App Store distribution provisioning profile.')
options = {'method': 'app-store-connect', 'teamID': team, 'signingStyle': 'manual', 'signingCertificate': 'Apple Distribution', 'provisioningProfiles': {'com.hoicompany.carddesk': profile['UUID']}, 'destination': 'export', 'manageAppVersionAndBuildNumber': False}
(root / 'export-options.plist').write_bytes(plistlib.dumps(options))
print(profile['UUID'])
PY
profiles_dir="$HOME/Library/MobileDevice/Provisioning Profiles"
mkdir -p "$profiles_dir" ios/output
profile_path="$profiles_dir/$profile_uuid.mobileprovision"
if [[ -e "$profile_path" ]]; then printf 'Profile already exists; refusing to overwrite it.\n' >&2; profile_path=''; exit 1; fi
cp "$build_temp/profile.mobileprovision" "$profile_path"
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release \
  -destination 'generic/platform=iOS' -archivePath ios/output/Hoi-Card-Desk-signed.xcarchive \
  CODE_SIGN_STYLE=Manual CODE_SIGN_IDENTITY='Apple Distribution' DEVELOPMENT_TEAM="$IOS_TEAM_ID" \
  PROVISIONING_PROFILE_SPECIFIER="$profile_uuid" OTHER_CODE_SIGN_FLAGS="--keychain $keychain_path" archive \
  | tee ios/output/signed-archive.log
xcodebuild -exportArchive -archivePath ios/output/Hoi-Card-Desk-signed.xcarchive \
  -exportPath ios/output/export -exportOptionsPlist "$build_temp/export-options.plist" \
  | tee ios/output/signed-export.log
printf 'Signed IPA exported to ios/output/export. No upload or distribution was performed.\n'
