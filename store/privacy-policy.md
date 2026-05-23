# Privacy Policy for Chat Exporter

Last updated: April 11, 2026

Chat Exporter is an independent Microsoft Edge extension that helps a user export a Microsoft 365 Copilot Chat conversation from `https://m365.cloud.microsoft/chat` into a print-friendly preview for printing or saving as PDF.

This project is not affiliated with Microsoft.

## Summary

Chat Exporter processes the content of the currently open Microsoft 365 Copilot Chat page inside the user's browser so it can generate a print-friendly transcript preview.

The extension does not sell personal information, does not use analytics or advertising trackers, and does not send conversation content to an external server controlled by the publisher of this extension.

## Information the extension accesses

When the user activates the extension on a supported page, the extension may access:

- The current page URL.
- The visible conversation content on the active Microsoft 365 Copilot Chat page.
- Message text, headings, lists, tables, citations, links, and images that are already present in the page content.
- Basic page metadata such as the page title.

## How the information is used

The extension uses that information only to:

- Detect whether the current tab is a supported Microsoft 365 Copilot Chat page.
- Extract the visible conversation content from the active page.
- Build a print-friendly transcript preview in the browser.
- Allow the user to print the preview or save it as PDF using the browser's own print flow.

## Storage and retention

The extension is designed to minimize storage:

- Export data is held temporarily in extension memory while the preview opens.
- The temporary export payload expires automatically after a short period or is cleared when the preview is consumed or dismissed.
- The extension does not intentionally persist transcript contents to extension storage, remote databases, or publisher-controlled servers.

If the user prints or saves a PDF, the resulting file is created by the browser or operating system under the user's control.

## Sharing and disclosure

The extension does not transmit exported conversation data to the publisher's servers.

The extension does not share conversation content with advertisers, data brokers, or analytics providers.

The extension may render links that were already present in the Copilot Chat page. If the user chooses to open one of those links, the browser will connect to that destination directly.

## Permissions

The extension currently uses the following capabilities:

- `activeTab`, to operate on the tab the user activates.
- `scripting`, to run the extraction flow on the supported page.
- Host access for `https://m365.cloud.microsoft/*`, to support Microsoft 365 Copilot Chat pages.

## Security

The extension is designed so that exported conversation data stays local to the browser during normal operation. The extension also limits rendered external URLs to standard `http` and `https` links in the export preview.

No software can guarantee absolute security. Users should avoid printing or exporting sensitive material unless they understand their organization's data handling requirements.

## Children's privacy

This extension is not directed to children.

## Changes to this policy

This policy may be updated if the extension's behavior changes. The latest version should be published at the URL linked from the Microsoft Edge Add-ons listing.

## Contact

For privacy questions, contact:

- Website: `[REPLACE_WITH_PUBLIC_SUPPORT_OR_CONTACT_PAGE_URL]`
