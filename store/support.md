# Support for Chat Exporter

Last updated: April 11, 2026

Chat Exporter is an independent Edge extension for exporting Microsoft 365 Copilot Chat conversations from `https://m365.cloud.microsoft/chat` into a print-friendly preview.

This project is not affiliated with Microsoft.

## Contact

- Support website: `[REPLACE_WITH_SUPPORT_URL]`

## What the extension supports

- Microsoft Edge
- Microsoft 365 Copilot Chat pages at `https://m365.cloud.microsoft/chat`
- Exporting the currently open conversation into a browser-based preview for printing or saving as PDF

## Known limitations

- The extension is intended for `m365.cloud.microsoft/chat`.
- `copilot.microsoft.com` is not supported by this extension because Edge restricts extension scripting there.
- The extension works with the content that is present in the page at the time of export. Changes to Microsoft's page structure may affect extraction quality until the extension is updated.

## Troubleshooting

If export does not work as expected:

1. Confirm that the current page is a conversation page at `https://m365.cloud.microsoft/chat`.
2. Refresh the page and wait for the conversation to finish loading.
3. Run the export again from the extension toolbar button.
4. If the preview opens with warnings or missing content, capture the page URL pattern and a screenshot of the issue before contacting support.

## When reporting a problem

Please include:

- The Edge version.
- The extension version.
- Whether the problem occurred on a supported `m365.cloud.microsoft/chat` page.
- A screenshot of the page and the export preview, if possible.
- Whether the issue is repeatable.
