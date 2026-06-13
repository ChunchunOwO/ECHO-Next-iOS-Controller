# ECHO iPhone

This is the first iPhone-side ECHO Link client. It is intentionally built with Expo + React Native so the mobile work can reuse TypeScript knowledge instead of starting with SwiftUI. For now, it only guarantees connection with the ECHO client, other features aren't guaranteed.


**YOU NEED NOTICED THAT ""Echo_IOS"" IT’S NOT A OFFICIAL PROJECT**

**Here is ECHO Project >> "github/Moekotori/ECHO"**

## What Works First

- Paste a desktop pairing URI such as `echo://pair?host=192.168.1.12&port=26789&token=...`.
- Save a manual LAN address and token.
- Call the desktop EchoLink API with `Authorization: Bearer <token>` and `x-echo-link-version: 1`.
- Read desktop playback status.
- Search the desktop local library.
- Send desktop playback commands: play/pause, previous, next, play track on PC.

## Desktop Protocol

The desktop source of truth is `src/main/connect/EchoLinkService.ts`.

Important endpoints:

- `GET /echo-link/v1/status`
- `GET /echo-link/v1/library/tracks?page=1&pageSize=40&q=...`
- `GET /echo-link/v1/library/albums?page=1&pageSize=40&q=...`
- `GET /echo-link/v1/library/albums/:albumId/tracks`
- `POST /echo-link/v1/playback/command`
- `POST /echo-link/v1/library/tracks/:trackId/stream`
- `GET /echo-link/v1/library/tracks/:trackId/lyrics`

The iPhone app currently focuses on controlling the PC. Phone-side streaming can be added on top of `createPhoneStream`.

## Run

```powershell
npm install
npm run start
```

For a real iPhone build, use a Mac with Xcode or Expo EAS. The app config already includes iOS local-network and local HTTP transport permissions.

## IPA Without Paid Apple Developer Account

You cannot build a working iPhone IPA directly on Windows because Xcode is required. From Windows, use the GitHub Actions workflow added at `.github/workflows/build-ios-unsigned.yml`:

1. Push this repo to GitHub.
2. Open GitHub > Actions > Build iOS unsigned IPA.
3. Click Run workflow.
4. Download the `ECHO-iPhone-unsigned-ipa` artifact.
5. Open Sideloadly on Windows, select the IPA, and sign/install it with a free Apple ID.

To avoid a paid Apple Developer account on a Mac, build an unsigned IPA locally and sign/install it with Sideloadly or AltStore using a free Apple ID:

```bash
bash scripts/build-unsigned-ipa-for-sideloadly.sh
```

The script outputs:

```text
build/ios-unsigned/ECHO-iPhone-unsigned.ipa
```

Then open Sideloadly, select the IPA, and install it to the iPhone with a free Apple ID. Free Apple ID signing usually expires after 7 days.

Alternatively, install directly from Xcode with a free Apple ID:

```bash
bash scripts/build-free-apple-id-with-xcode.sh
```
