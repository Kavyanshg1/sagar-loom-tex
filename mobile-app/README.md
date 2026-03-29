# Textile Flow Tracker Mobile

Separate Expo React Native app for iOS and Android that connects to the existing Textile Flow Tracker backend.

## Features

- Dashboard with yarn and fabric balances
- Add Entry flow for yarn purchases, processing, direct processing, and dyeing
- AI Upload flow with camera and file picker
- Records listing with search
- Settings for API URL, starting stock, password, and clear-all-data

## Backend

Set the mobile app API URL to your machine's local network address, for example:

`http://192.168.1.5:8000`

Do not use `localhost` on a phone.

## Run

```bash
npm install
npm run start
```

Then open with Expo Go, Android emulator, or iOS simulator.

## Device Builds

Android:

```bash
npx expo run:android
```

iOS:

```bash
npx expo run:ios
```

## Notes

- This project is fully separate from the desktop React frontend.
- The existing backend and desktop applications remain unchanged.
