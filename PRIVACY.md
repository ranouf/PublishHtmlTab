# Privacy Policy

_Last updated: March 27, 2026_

This Privacy Policy explains how the **PublishHtmlTab** Azure DevOps extension handles data.

Repository: [https://github.com/ranouf/PublishHtmlTab](https://github.com/ranouf/PublishHtmlTab)

## Overview

PublishHtmlTab is an Azure DevOps extension that displays HTML reports published from build artifacts inside Azure DevOps.

The extension is designed to minimize data collection. It does not intentionally collect or transmit personally identifiable information for product analytics. When analytics is enabled, the extension uses **Google Analytics** to collect limited, anonymous usage data about how the extension is used.

## What Data May Be Collected

When analytics is enabled, the extension may send limited usage events to Google Analytics, such as:

- extension view opened
- tab selection changes
- download button clicks
- download failures
- link clicks inside rendered reports
- navigation failures inside the extension

These events are used to understand feature usage and improve the extension.

The analytics payload is intentionally restricted to low-cardinality technical metadata, which may include:

- extension version
- Azure DevOps build identifier
- display mode used by the extension
- number of tabs or pages shown
- whether a download action is available
- selected tab index or tab type
- normalized interaction source, link type, target type, or error category
- hashed internal report path references
- coarse timing values related to user interactions

## What Data Is Not Intentionally Collected

PublishHtmlTab is designed not to intentionally collect or send:

- report HTML content
- raw report content
- usernames
- email addresses
- access tokens
- query string values
- raw internal URLs
- raw file system paths
- personal identifiers entered by users

The extension also avoids sending raw report targets when they may reveal internal information. Internal paths are sanitized and hashed before being used for analytics. External links are classified by type only; their full URLs are not intentionally forwarded for analytics purposes.

## Google Analytics

PublishHtmlTab uses **Google Analytics** to collect anonymous usage information about extension interactions.

This analytics is used solely to:

- understand which features are used
- identify navigation or download issues
- improve the usability, reliability, and maintenance of the extension

The extension is configured to reduce unnecessary data sharing, including:

- disabling automatic page view tracking
- disabling Google Signals
- disabling ad personalization signals
- enabling IP anonymization where supported by Google Analytics settings

Google Analytics is a third-party service operated by Google. Data sent to Google Analytics is subject to Google's own terms and privacy practices. For more information, see:

- [Google Privacy Policy](https://policies.google.com/privacy)
- [How Google uses information from sites or apps that use its services](https://policies.google.com/technologies/partner-sites)

## Legal Basis and Intended Use

This extension is intended for technical and operational use within Azure DevOps environments. Any analytics collected through the extension is intended for product improvement, troubleshooting trends, and feature prioritization.

The extension is not intended to profile individual users, and no personally identifiable information is intentionally collected for analytics.

## Browser and Environment Controls

If the browser indicates that **Do Not Track** is enabled, the extension is designed to disable analytics collection.

In some Azure DevOps environments, browser settings, network policies, content security restrictions, or tracking protections may prevent analytics requests from being sent.

## Data Sharing

Analytics data may be transmitted to Google Analytics as part of the extension's telemetry implementation.

Other than this analytics processing, this policy does not state that no data is ever transmitted externally. Azure DevOps, the browser, network infrastructure, and third-party services may process data according to their own configurations and policies.

## Data Retention

PublishHtmlTab itself does not maintain a separate analytics database within this repository. Analytics data, when sent, is processed and retained according to the configuration and retention rules of the Google Analytics property used for this extension.

## Security and Data Minimization

The extension is designed with data minimization in mind:

- analytics fields are explicitly whitelisted
- sensitive raw values are excluded where possible
- internal targets are normalized before tracking
- hashed references are preferred over raw internal paths

However, no Internet-based service can guarantee absolute security. Users should avoid publishing sensitive content unless appropriate organizational controls are in place.

## Changes to This Policy

This Privacy Policy may be updated from time to time to reflect changes in the extension, analytics implementation, or legal requirements. The latest version will be published in this repository.

## Contact

For questions, issues, or requests related to this extension, please use the GitHub repository:

[https://github.com/ranouf/PublishHtmlTab](https://github.com/ranouf/PublishHtmlTab)
