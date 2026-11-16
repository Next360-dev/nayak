# Nayak Mobile (Expo)

## Run
```bash
cd mobile/app
npm install
npx expo start
```
Set `API_BASE_URL` env (e.g. `API_BASE_URL=https://api.example.com npx expo start`).

## Typecheck / Lint
```bash
npx tsc --noEmit
npx expo lint
```

## Build (EAS)
```bash
npx eas-cli build --profile preview
```
Store publishing requires explicit approval.