# Language Lens Dictionary

Language Lens is a personal, multilingual dictionary and study tool built with React and Vite. It is designed for collecting words while learning languages, enriching English entries with dictionary data, practicing pronunciation, and reviewing saved terms with flashcards.

The app is local-first: dictionary entries, favorites, custom languages, custom word types, and recorded pronunciations are stored in the browser. A server-side proxy handles translation requests so provider API keys are never included in the browser bundle.

## Features

### Dictionary entries

- Create entries under English, Spanish, French, Korean, or another custom language.
- Only **New Term** is required when saving an entry. Translation, definition, example, word type, pronunciation, and favorite status can be added later.
- Edit or delete any saved entry.
- Search across the current language library.
- Mark entries as favorites for focused study.
- Reorder languages from the language menu.
- Switch between light and dark themes.

### Lookup and language assistance

- English autocomplete suggestions are provided by Datamuse while entering a new English term.
- English definitions, part of speech, and automatic phonetic pronunciation are looked up from Free Dictionary API when the term field loses focus.
- Korean terms receive a generated romanization using the app's built-in Hangul romanization logic.
- The Translate action sends a request to the local or deployed backend proxy. Langbly is used when `LANGBLY_API_KEY` is configured, with LibreTranslate available as a fallback.
- Browser speech synthesis can read a term aloud.

### Personal pronunciation recordings

- The **Your Pronunciation** field supports optional typed pronunciation notes.
- **Record voice** requests microphone access and records through the browser's `MediaRecorder` API.
- A recording can be played back before the entry is saved and from the saved entry afterward.
- Recordings are stored as data URLs in browser `localStorage`, so they are device/browser-specific and count toward browser storage limits. They are included in JSON exports, but large recordings can make exports sizable.

### Study and data management

- Flashcard mode shows saved terms and can reveal definitions and examples.
- Study mode can be limited to favorite entries.
- Export the current dictionary to a JSON file.
- Import a previously exported JSON dictionary.
- Imported entries are validated and normalized before being added to the app.

### Progressive Web App

- The production build includes a web app manifest and service worker.
- On supported browsers, the app can be installed to an iPhone or Android home screen from its public HTTPS URL.
- The service worker caches the application shell for offline loading. External dictionary, autocomplete, translation, and provider requests still require network access.

## Technology

- React 19
- Vite 8
- Plain JavaScript and CSS
- Node.js HTTP server for the translation proxy and production static hosting
- Free Dictionary API for English dictionary data
- Datamuse API for English autocomplete
- Langbly or LibreTranslate for translations
- Browser Web Speech and MediaRecorder APIs for pronunciation features

## Requirements

- Node.js 20 or newer is recommended. The project uses Node's built-in `--env-file` support for the proxy command.
- npm
- A Langbly API key for translation through Langbly, or a LibreTranslate key if using the fallback provider

## Local development

Install dependencies:

```powershell
npm install
```

Create a local `.env` file from `.env.example` and add the provider key. Do not use a `VITE_` prefix for server-only keys:

```dotenv
LANGBLY_API_KEY=your_langbly_key
LIBRETRANSLATE_API_KEY=
TRANSLATION_PROXY_PORT=8787
PROXY_ALLOWED_ORIGIN=http://localhost:5173
```

Start the translation proxy in one terminal:

```powershell
npm run proxy
```

Start Vite in another terminal:

```powershell
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173/`. Vite forwards `/api/translate` to the proxy at `http://localhost:8787` during development.

To access the development app from another device on the same network:

```powershell
npm run dev -- --host 0.0.0.0
```

The computer must remain powered on, and both the Vite server and proxy must remain running. Microphone access is generally available on `localhost`; other devices require a secure HTTPS context in most browsers.

## Production build and hosting

The production server serves both the compiled frontend and the translation API from one origin. This means the browser can continue using the relative `/api/translate` path after deployment.

Build the frontend:

```powershell
npm run build
```

Run the combined production service locally:

```powershell
$env:PORT = '8790'
npm start
```

The service exposes:

- `GET /` and static assets from `dist`
- `GET /health` for a health check
- `POST /api/translate` for translation requests

### Render deployment

The repository includes `render.yaml` for a Render web service. In Render:

1. Connect the GitHub repository.
2. Create a new Web Service, or use the Blueprint configuration from `render.yaml`.
```

```powershell
npm run build
npm run lint
```

The build command verifies that the production bundle compiles. The lint command checks the source and may report existing React hook or configuration issues separately from build correctness.

## Project structure

```text
src/
  App.jsx       Main dictionary, study, lookup, recording, and persistence logic
  App.css       App layout and responsive component styles
  index.css     Global theme variables and base styles
  main.jsx      React entry point and production service-worker registration
server/
  translation-proxy.js  Translation proxy and production static-file server
public/
  manifest.webmanifest  PWA metadata
  sw.js                 Application-shell service worker
render.yaml             Render web-service configuration
vite.config.js          Vite development proxy configuration
```
