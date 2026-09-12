# PDF Voice Reader

A public, client-side PDF text-to-voice reader. Select or drop a PDF and read its extracted text with the browser’s SpeechSynthesis API. Files are processed in the current browser tab and are never uploaded.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Verify and build

```bash
npm run lint
npm run build
```

The production build is a static export in `out/`; deploy that directory to any static host. The root artifact is `out/index.html`.

## Privacy and processing

PDF parsing happens entirely in the browser with `pdfjs-dist`. No server, API, credentials, analytics upload, or file transfer is used. Reset the reader or close the tab to clear the in-memory document.

## Browser support

PDF text extraction requires a modern browser with ES modules and Web Workers. Speech controls require the browser’s `SpeechSynthesis` API and at least one installed voice. Voice availability and speech behavior vary by browser and operating system. Image-only or encrypted PDFs may not yield selectable text; use an OCR-enabled PDF when needed.

Files must be PDFs no larger than 25 MB. The app is a static Next.js App Router export and has no backend runtime.
