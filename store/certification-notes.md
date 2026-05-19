# Notes for Certification Draft

Paste and adapt the following for Partner Center's `Notes for certification` field.

---

This extension is an independent Edge extension for exporting the currently open Microsoft 365 Copilot Chat conversation into a print-friendly transcript preview.

Supported page:

- `https://m365.cloud.microsoft/chat`

Important scope note:

- The extension is intended only for Microsoft 365 Copilot Chat pages on `m365.cloud.microsoft/chat`.
- `copilot.microsoft.com` is not supported by this extension because Edge restricts extension scripting on that site.

Testing steps:

1. Sign in to a Microsoft 365 account that has access to Microsoft 365 Copilot Chat.
2. Open `https://m365.cloud.microsoft/chat`.
3. Open any conversation with visible messages.
4. Click the extension toolbar button.
5. Confirm that a preview tab opens.
6. Confirm that the preview shows the exported conversation in a print-friendly layout.
7. Confirm that the `Print to PDF` button opens the browser print flow.

Expected behavior:

- The extension exports the currently open conversation only.
- The preview is generated locally in the browser.
- The extension does not require a separate account, backend service, or onboarding flow.

Privacy and data handling:

- The extension processes conversation content locally in the browser to generate the preview.
- The extension does not upload transcript content to a publisher-controlled server during normal use.
- Export data is held temporarily in memory while the preview opens.

Test credentials, if needed:

- Username: `[REPLACE_IF_NEEDED]`
- Password: `[REPLACE_IF_NEEDED]`
- MFA instructions: `[REPLACE_IF_NEEDED]`

Additional notes:

- If the test environment does not include Microsoft 365 Copilot access, the extension cannot be fully exercised.
- If this submission is an update, summarize the changes here before publishing.

---
