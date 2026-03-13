# Project Guidelines

## Objective
Build a Chrome extension for internal support agents that combines case details from ServiceNow with device details from Ivanti Neurons MDM, then produces a clean Work Notes template that agents can copy into ServiceNow.

The extension must prioritize reliability, low maintenance, and minimum required permissions. This project handles employee and device data, so all implementation decisions must reduce privacy risk and avoid unnecessary collection, persistence, or transmission of data.

## Product Scope
The extension should support this workflow:

1. An agent opens a ServiceNow case and reads the Description field.
2. The extension extracts only the fields that are intentionally available on the case page:
   - Name
   - Email
   - Callback
   - ADX or employee ID
   - Issue / Error message
3. The agent opens the employee profile in Ivanti Neurons MDM and selects the device.
4. The extension extracts the device details needed for the Work Notes template:
   - Corp/BYOD
   - Device Model
   - Serial number
   - MDN
   - iOS Version
5. The extension merges both sources into a formatted ServiceNow Work Notes template.
6. The agent can review and copy the generated output before pasting it into ServiceNow.

Do not implement automatic form submission. The correct product behavior is assisted extraction plus copy-ready output.

## Recommended Technical Stack
Use the following stack unless the repository already establishes a different standard:

- Language: TypeScript
- Extension platform: Chrome Extension Manifest V3
- Build tool: Vite
- Chrome extension integration for Vite: @crxjs/vite-plugin
- Validation and normalization: Zod
- Testing:
  - Vitest for unit tests
  - Playwright for end-to-end browser workflow tests where practical
- Styling: plain CSS or CSS modules only

Avoid React unless the UI grows beyond a small popup, options page, or lightweight injected panel. For this project, the core difficulty is DOM extraction across two enterprise web apps, not rich UI state management. Vanilla TypeScript with small, well-factored modules is the preferred default.

## Why This Stack Is Preferred
- TypeScript reduces mistakes in field mapping, parsing, and cross-page message contracts.
- Manifest V3 is the current Chrome extension standard.
- Vite with CRXJS provides a fast development loop and a clean extension build pipeline without unnecessary custom bundler setup.
- Zod gives explicit schemas for extracted data, allowing the extension to reject partial or malformed DOM captures instead of silently generating bad notes.
- Vitest is sufficient for parser and formatter logic.
- Playwright is the best option for realistic workflow validation when HTML fixtures or controlled test pages are available.

## Architecture Requirements
Structure the extension around clear separation of responsibilities.

Recommended modules:

1. Content script for ServiceNow
   - Detect the relevant case page
   - Extract case metadata from the Description field or visible form fields
   - Inject a small, non-intrusive UI control only if needed

2. Content script for Ivanti Neurons MDM
   - Detect the user device details page
   - Extract the required device attributes from the currently selected device view

3. Background service worker
   - Coordinate messages between tabs and content scripts
   - Store the in-progress merged payload in extension storage
   - Own clipboard-ready template generation only if central orchestration is useful

4. Shared domain layer
   - Typed interfaces and Zod schemas for case data, device data, and merged template data
   - Parsing helpers
   - Formatting helpers for final Work Notes output

5. Minimal UI layer
   - Popup or lightweight injected panel for status, preview, and copy action
   - No heavy client framework by default

## Data Model Requirements
Keep the internal model explicit and normalized.

Suggested entities:

- CaseDetails
  - name
  - email
  - callback
  - adx
  - issueMessage

- DeviceDetails
  - ownershipType
  - deviceModel
  - serialNumber
  - mdn
  - iosVersion

- WorkNotesTemplate
  - name
  - email
  - callback
  - adx
  - corpOrByod
  - deviceModel
  - serialNumber
  - mdn
  - iosVersion
  - issueMessage
  - troubleshoot
  - escalated

Normalize empty or missing fields to explicit blank strings only at final formatting time. Before that, use nullable or optional types so missing extraction failures are visible during validation.

## Extraction Strategy
Both target web apps are likely dynamic and subject to UI changes. Extraction logic must therefore be resilient.

Use this order of preference for field extraction:

1. Stable attributes such as name, aria-label, data attributes, input labels, or semantic relationships
2. Nearby label-to-value traversal based on visible text labels
3. Controlled fallback selectors with clear helper functions

Do not rely on brittle absolute CSS selectors tied to deep layout nesting.

For extraction code:

- Build reusable helpers such as findFieldByLabel, readDefinitionListValue, readInputByLabel, and readNearestValueBlock
- Support SPA rendering delays with MutationObserver, retry windows, or explicit page-ready checks
- Fail with structured errors when required fields are not found
- Keep selectors centralized per site so changes can be patched in one place

## Permissions and Security
Use the minimum possible permissions.

- Restrict host permissions to the exact ServiceNow and Ivanti domains used by the team
- Prefer activeTab plus explicit host permissions only where necessary
- Do not request broad permissions unrelated to extraction, storage, clipboard, or scripting
- Do not send employee or device data to external services
- Do not add analytics, telemetry, or remote logging
- Avoid writing sensitive data to console logs except in tightly controlled development debugging
- Clear transient data when it is no longer needed

Default assumption: all extracted information is sensitive internal operational data.

## UX Requirements
The user experience should be optimized for speed and low cognitive load.

- The extension should show a clear status such as:
  - ServiceNow data captured
  - Ivanti data captured
  - Template ready to copy
- Provide a preview before copy when practical
- Provide a one-click copy action
- Make failures actionable, for example: "Could not find serial number on current Ivanti page"
- Avoid intrusive overlays or large floating widgets that interfere with enterprise tools

## Output Formatting Requirements
The final generated template must match the ServiceNow work note structure exactly unless the product owner changes the template.

Expected output shape:

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

Preserve label capitalization and punctuation exactly.

## Recommended Build Phases
Implement in this order:

1. Project scaffolding
   - Manifest V3
   - Vite build
   - TypeScript config
   - extension entry points

2. Shared data contracts
   - Zod schemas
   - formatter utilities
   - storage model

3. ServiceNow capture
   - reliable extraction from Description and related case fields

4. Ivanti capture
   - reliable extraction from selected device details

5. Merge and preview flow
   - state coordination
   - copy-ready text generation

6. Hardening
   - selector resilience
   - error handling
   - fixture-based tests

## Coding Conventions For This Project
- Prefer small pure functions for DOM-to-data parsing and for output formatting.
- Keep site-specific logic isolated by product and page type.
- Avoid mixing DOM querying, validation, formatting, and storage logic in the same module.
- Use strict TypeScript settings.
- Use explicit return types on exported functions.
- Avoid premature abstraction; add generic helpers only after at least two real use cases exist.
- Keep CSS minimal and functional.

## Testing Expectations
At minimum, cover these areas:

- Parsing of ServiceNow Description field into structured case data
- Parsing of Ivanti page fragments into structured device data
- Template formatting with full data
- Template formatting with missing optional fields
- Failure behavior when required labels are absent

Prefer HTML fixtures for extraction tests so parsers can be validated without requiring live access to enterprise systems.

## Non-Goals
Do not build any of the following unless explicitly requested:

- Automatic case submission in ServiceNow
- Automated navigation or workflow execution across tabs
- Remote backend services
- Cloud storage or sync
- Multi-browser support beyond Chrome-compatible browsers
- Complex dashboards or analytics

## Definition Of Done
A feature is not done unless all of the following are true:

- It works on the actual target page type or a verified fixture representing it
- Required fields are validated before generating output
- Failure states are understandable to an agent using the tool during a live call
- Permissions remain minimal
- No external transmission of captured data occurs
- The generated text matches the agreed template exactly

## First Build Decision
Unless the user directs otherwise, future implementation should start by scaffolding a Manifest V3 extension using Vite, CRXJS, TypeScript, Zod, Vitest, and plain CSS, then build the extraction logic around fixture-tested parser functions before wiring UI controls.