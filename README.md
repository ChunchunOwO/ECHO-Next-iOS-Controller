# ECHO iPhone

An experimental iOS companion app for [ECHO NEXT](https://github.com/Moekotori/ECHO). It turns an iPhone into a clean music-player style client for your PC library: browse tracks, control playback, view current status, and optionally stream PC music to the phone.

> This is an unofficial community project. It is not maintained by the official ECHO project.
> If you have any concerns regarding copyright infringement, suggestions, or questions, you can find me in the official ECHO QQ group: @白雪ユキ.

## Highlights

- Simple playback page with a compact gray/white visual style.
- Acrylic-style bottom dock with three pages: Playback, Library, and Connection.
- Pairing-link and manual LAN connection support.
- Live playback status refresh for title, state, progress, volume, and queue.
- Draggable playback progress bar and draggable volume bar.
- PC playback controls: play/pause, previous, next, seek, volume, and play library tracks.
- Phone streaming mode for supported local tracks through EchoLink stream URLs.
- Current queue popover from a small playlist button.
- Single-track repeat button with real repeat behavior.
- Lyrics toggle UI prepared for the next lyrics panel.
- Library list with artwork, concise tags, duration, and playback entry.
- Artwork loading through `expo-image` with memory/disk caching and fallback handling.
- Optional technical tags when the desktop EchoLink API exposes them: codec, sample rate, bit depth, and bitrate.

## Status

This app is focused on proving and improving the iPhone-side EchoLink experience. The current build is usable as a PC controller and early phone-streaming client, but it is still experimental.

Current limitations:

- The desktop ECHO NEXT app must have EchoLink enabled.
- iPhone and PC must be on the same LAN, and Windows Firewall must allow ECHO NEXT.
- Phone streaming depends on the desktop endpoint and the track format being playable on iOS.
- Some advanced features, such as a full lyrics panel and richer queue editing, are UI-ready but not finished.
- This repo is Expo/React Native based, not a native SwiftUI app.

## Requirements

- Node.js and npm
- Expo CLI through `npx expo`
- A Mac with Xcode for local iOS builds, or GitHub Actions for an unsigned IPA artifact
- ECHO NEXT desktop with EchoLink support
- Sideloadly, AltStore, Xcode, or another signing/install path for real-device testing

## Install And Run

```powershell
npm install
npm run start
```

For static checks:

```powershell
npm run typecheck
```

For an Expo iOS export check:

```powershell
npx expo export --platform ios --output-dir build\export-check
```

## Connect To ECHO NEXT

Use either pairing-link mode or manual mode.

Pairing link example:

```text
echo://pair?host=192.168.1.12&port=26789&token=...
```

Manual fields:

- Host: your PC LAN IP, for example `192.168.2.27`
- Port: usually `26789`
- Token: copied from the desktop EchoLink pairing screen

If connection fails, check:

- The iPhone and PC are on the same Wi-Fi/LAN.
- ECHO NEXT is running and EchoLink is enabled.
- Windows Firewall allows ECHO NEXT on private networks.
- You are using the PC LAN IP, not `localhost` or a virtual adapter IP.
- iOS local network permission is allowed for the app.

## EchoLink Protocol

The desktop source of truth is:

```text
src/main/connect/EchoLinkService.ts
```

Important endpoints used by this app:

```text
GET  /echo-link/v1/status
GET  /echo-link/v1/library/tracks?page=1&pageSize=40&q=...
GET  /echo-link/v1/library/albums?page=1&pageSize=40&q=...
GET  /echo-link/v1/library/albums/:albumId/tracks
POST /echo-link/v1/playback/command
POST /echo-link/v1/library/tracks/:trackId/stream
GET  /echo-link/v1/library/tracks/:trackId/lyrics
```

Requests use:

```text
Authorization: Bearer <token>
x-echo-link-version: 1
```

## Build Unsigned IPA

iOS builds require macOS and Xcode. Windows cannot directly build a working IPA without a macOS builder.

### GitHub Actions

1. Push this repo to GitHub.
2. Open GitHub Actions.
3. Run `Build iOS unsigned IPA`.
4. Download the `ECHO-iPhone-unsigned-ipa` artifact.
5. Sign and install with Sideloadly, AltStore, or another free Apple ID flow.

### Local Mac Build

```bash
bash scripts/build-unsigned-ipa-for-sideloadly.sh
```

Output:

```text
build/ios-unsigned/ECHO-iPhone-unsigned.ipa
```

Then sign/install it with Sideloadly or AltStore. Free Apple ID signing usually expires after 7 days.

### Xcode Free Apple ID

```bash
bash scripts/build-free-apple-id-with-xcode.sh
```

The script opens the generated Xcode workspace. Select your Apple ID team, connect the iPhone, and press Run.

## Assets

The repo can include a custom `Assets.car` at the project root. The unsigned IPA script copies it into the final `.app` bundle during packaging. If the app icon still appears as the default gray placeholder, make sure the asset catalog contains an `AppIcon` entry and that iOS build settings point to it.

Song artwork is loaded from EchoLink artwork URLs and rendered with `expo-image`. Failed artwork URLs fall back to a neutral placeholder instead of leaving a broken gray image area.

## Project Structure

```text
App.tsx                         Main mobile UI and playback logic
app.json                        Expo iOS configuration
src/echoLink/client.ts          EchoLink HTTP client
src/echoLink/types.ts           Mobile-side EchoLink types
src/echoLink/pairing.ts         Pairing URI parser
src/storage/connectionStore.ts  Saved connection storage
scripts/                        iOS build helpers
.github/workflows/              Unsigned IPA workflow
```

## Upload Checklist

Upload:

- `.github/workflows/build-ios-unsigned.yml`
- `.gitattributes`
- `.gitignore`
- `app.json`
- `App.tsx`
- `Assets.car`
- `package.json`
- `package-lock.json`
- `README.md`
- `tsconfig.json`
- `scripts/`
- `src/`

Do not upload:

- `node_modules/`
- `build/`
- generated `.ipa` files

## Roadmap

- Real lyrics panel connected to the existing lyrics toggle.
- Better phone streaming controls and handoff polish.
- Richer queue editing.
- Album and artist browsing pages.
- More resilient artwork handling for uncommon formats.
- More complete release workflow for signed builds.
