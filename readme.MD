# ServiceNow Form Filler

ServiceNow Form Filler is a Chrome extension that helps support agents collect case details from ServiceNow and device details from Ivanti Neurons MDM, then generate a copy-ready Work Notes template.

The current implementation is focused on assisted extraction only. It does not submit forms automatically and it does not send captured data to external services.

## Current Status

The project currently includes:

- A Manifest V3 Chrome extension
- A ServiceNow content script to capture case details from the Description field
- An Ivanti content script to capture device details from the selected device view
- A background service worker for message routing and local storage
- A popup UI for status, preview, copy, and clear actions
- Unit tests for the ServiceNow description parser and template formatter

## Tech Stack

- TypeScript
- Vite
- CRXJS Vite plugin
- Zod
- Vitest
- Plain CSS

## Supported Workflow

1. Open a ServiceNow case.
2. Use the extension's ServiceNow capture button to read case details from the Description field.
3. Open the employee's device page in Ivanti Neurons MDM.
4. Use the extension's Ivanti capture button to read the device details from the current view.
5. Open the extension popup.
6. Review the generated Work Notes text.
7. Copy the output and paste it into ServiceNow Work Notes.

## Data Captured

### From ServiceNow

- Name
- Email
- Callback
- ADX or employee ID
- Issue / Error message

### From Ivanti Neurons MDM

- Corp/BYOD
- Device Model
- Serial number
- MDN
- iOS Version

## Output Template

The extension formats the captured values into this exact structure:

```text
Name: {value}
Email: {value}
Callback: {value}
ADX: {value}
Corp/BYOD: {value}
Device Model: {value}
Serial number: {value}
MDN: {value}
iOS Version: {value}
Issue / Error message: {value}
Troubleshoot: {value}
Escalated: {value}
```

## Sanitized Example

This example is intentionally fictional and contains no real employee, device, or contact data.

```text
Name: Example User
Email: example.user@example.com
Callback: 5550101234
ADX: E00000000
Corp/BYOD: Corp
Device Model: iPhone 13
Serial number: ABC123EXAMPLE
MDN: +15550101234
iOS Version: 17.4.1
Issue / Error message: Device does not power on after being unplugged.
Troubleshoot:
Escalated: Yes/No
```

## Local Development

Install dependencies:

```bash
npm install
```

Run tests:

```bash
npm test
```

Build the extension:

```bash
npm run build
```

Start Vite in development mode:

```bash
npm run dev
```

## Loading The Extension In Chrome

After building, the extension output is in the `dist` folder.

To load it in Chrome:

1. Open `chrome://extensions`
2. Enable Developer mode
3. Click Load unpacked
4. Select the `dist` folder

If you make code changes later:

1. Run `npm run build` again
2. Go back to `chrome://extensions`
3. Click Reload on the unpacked extension
4. Refresh any open ServiceNow or Ivanti tabs

## Project Structure

```text
src/
	background/          Background service worker
	content/             Content scripts and DOM helpers
	popup/               Popup UI
	shared/              Schemas, formatter, messages, storage
	__tests__/           Unit tests
manifest.json          Extension manifest source
vite.config.ts         Vite build config
```

## Security Notes

- Captured data is stored only in `chrome.storage.local`
- No external APIs or remote logging are used
- The extension is designed for minimum required permissions
- Transient captured data can be cleared from the popup

## Known Limits

- The ServiceNow extractor currently depends primarily on the Description field format
- The Ivanti extractor uses label-based DOM lookups and may need selector tuning against the real tenant UI
- The bundled icons are placeholder icons suitable for development, not final branding

## Next Improvements

- Add fixture-based tests for Ivanti DOM extraction
- Harden selectors against more ServiceNow and Ivanti layout variations
- Improve user-facing error feedback when required fields are missing
- Add packaging and GitHub Actions automation for release artifacts
