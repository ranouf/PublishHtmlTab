# Privacy Policy

_Last updated: March 27, 2026_

This Privacy Policy describes how the **PublishHtmlTab** Azure DevOps extension handles data.

Repository: [https://github.com/ranouf/PublishHtmlTab](https://github.com/ranouf/PublishHtmlTab)

## Overview

PublishHtmlTab displays published HTML reports inside Azure DevOps.

In branch `v.2.2`, the extension includes a Google Analytics integration for limited product-usage telemetry. That telemetry is intended to help understand feature usage and navigation or download issues within the extension.

The implementation is designed to reduce the amount of data sent in analytics events. However, use of Google Analytics means certain technical request metadata may still be processed by Google as part of providing that service.

## Google Analytics

The extension uses **Google Analytics 4** (`gtag.js`) in branch `v.2.2`.

Based on the current implementation:

- analytics is enabled by default in the client code because a Google Analytics measurement ID is embedded in the extension bundle
- analytics is not sent when the browser reports **Do Not Track** as enabled
- analytics may also fail to load or send because of browser settings, content security restrictions, network controls, ad/tracker blocking, or similar runtime conditions

The Google Analytics integration is configured to:

- disable automatic page view tracking
- disable Google Signals
- disable ad personalization signals
- request IP anonymization
- use a fixed Marketplace page location rather than the live Azure DevOps page URL
- clear the page referrer value

## Events Tracked

The implementation currently tracks the following event types:

- extension view opened
- tab or report selection changes
- archive download clicked
- archive download failures
- link clicks inside rendered reports
- navigation failures inside the extension

## Data Intended to Be Sent in Analytics

The analytics implementation is designed to send only a limited set of technical and interaction fields, such as:

- Azure DevOps build identifier
- extension version
- display mode (`legacy` or `manifest`)
- number of tabs or pages
- whether archive download is available
- selected tab index and tab type
- navigation source
- download type
- link type and target kind
- normalized error category
- coarse timing values related to interactions
- a hashed value derived from certain internal report paths

These values are mapped through a fixed whitelist in the code before being passed to Google Analytics.

## Data the Analytics Payload Is Not Designed to Send

Based on the current implementation, the analytics payload is not designed to intentionally send the following to Google Analytics:

- report HTML content
- raw report content
- access tokens
- raw query string values from tracked report paths
- raw external link URLs
- raw internal report paths when a tracked path is included in analytics
- usernames
- email addresses
- other direct personal identifiers entered by users

Internal tracked paths are normalized and hashed before transmission. External links are classified by category only, without forwarding the raw external URL in the analytics event payload.

## Azure DevOps Host State

Separately from Google Analytics, the extension updates Azure DevOps host query parameters to preserve report navigation state. This may include internal attachment identifiers such as the selected report or summary tab.

This host-state behavior is part of the extension’s navigation experience and is distinct from the Google Analytics payload.

## Third-Party Processing

When analytics is active, data is transmitted to **Google Analytics**, a third-party service operated by Google.

As with other web analytics services, Google may process technical request metadata necessary to provide the service. Depending on Google’s infrastructure and your organization’s configuration, this processing may occur outside the country where the user is located.

Google’s handling of data is governed by Google’s own terms and privacy documentation, including:

- [Google Privacy Policy](https://policies.google.com/privacy)
- [How Google uses information from sites or apps that use its services](https://policies.google.com/technologies/partner-sites)

## Data Retention

This repository does not maintain a separate analytics database for PublishHtmlTab.

If analytics is sent, retention and further processing are governed by the configuration of the relevant Google Analytics property and by Google’s own service practices.

## Security and Data Minimization

The current implementation includes data-minimization measures such as:

- a fixed event schema
- explicit parameter whitelisting
- normalization of tracked internal paths
- hashing of tracked internal paths before transmission
- suppression of analytics when Do Not Track is enabled

These measures reduce, but do not eliminate, privacy risk. Organizations should evaluate whether the use of Google Analytics is appropriate for their environment and compliance requirements.

## Changes to This Policy

This Privacy Policy may be updated to reflect changes to the extension, its analytics implementation, or applicable requirements. The latest version will be published in this repository.

## Contact

For questions or issues related to this extension, please use the GitHub repository:

[https://github.com/ranouf/PublishHtmlTab](https://github.com/ranouf/PublishHtmlTab)
