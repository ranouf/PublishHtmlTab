# Privacy Policy

_Last updated: March 27, 2026_

This Privacy Policy describes how the **PublishHtmlTab** Azure DevOps extension handles data.

Repository: [https://github.com/ranouf/PublishHtmlTab](https://github.com/ranouf/PublishHtmlTab)

## Overview

PublishHtmlTab displays published HTML reports inside Azure DevOps.

The extension includes a limited anonymous tracking implementation used to understand feature usage and diagnose navigation or download issues within the extension.

## Tracking Provider

The extension currently sends telemetry to **Amplitude** using the HTTP V2 API.

Based on the current implementation:

- tracking is enabled by default because the extension bundle contains a public Amplitude project API key
- tracking is not sent when the browser reports **Do Not Track** as enabled
- tracking is not sent when the organization-level setting disables it
- tracking is not sent when the local diagnostic override disables it

## Events Tracked

The implementation currently tracks the following event types:

- extension view opened
- tab or report selection changes
- archive download clicked
- archive download failures
- link clicks inside rendered reports
- navigation failures inside the extension

## Data Intended to Be Sent in Tracking Events

The tracking implementation is designed to send only a limited set of technical and interaction fields, such as:

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
- a generated anonymous device identifier stored locally by the extension

These values are mapped through a fixed whitelist in the code before being sent.

## Data the Tracking Payload Is Not Designed to Send

Based on the current implementation, the tracking payload is not designed to intentionally send the following:

- report HTML content
- raw report content
- access tokens
- raw query string values from tracked report paths
- raw external link URLs
- raw internal report paths when a tracked path is included in tracking
- usernames
- email addresses
- other direct personal identifiers entered by users

Internal tracked paths are normalized and hashed before transmission. External links are classified by category only, without forwarding the raw external URL in the tracking payload.

## Azure DevOps Host State

Separately from tracking, the extension updates Azure DevOps host query parameters to preserve report navigation state. This may include internal attachment identifiers such as the selected report or summary tab.

This host-state behavior is part of the extension’s navigation experience and is distinct from the tracking payload.

## Third-Party Processing

When tracking is active, data is transmitted to **Amplitude**, a third-party tracking service.

As with other tracking services, Amplitude may process technical request metadata necessary to provide the service. Depending on Amplitude’s infrastructure and your organization’s configuration, this processing may occur outside the country where the user is located.

Amplitude’s handling of data is governed by Amplitude’s own terms and privacy documentation, including:

- [Amplitude Privacy Notice](https://amplitude.com/privacy)
- [Amplitude Security Overview](https://amplitude.com/security)

## Data Retention

This repository does not maintain a separate tracking database for PublishHtmlTab.

If tracking is sent, retention and further processing are governed by the configuration of the relevant Amplitude project and by Amplitude’s own service practices.

## Security and Data Minimization

The current implementation includes data-minimization measures such as:

- a fixed event schema
- explicit parameter whitelisting
- normalization of tracked internal paths
- hashing of tracked internal paths before transmission
- suppression of tracking when Do Not Track is enabled
- organization-level control to disable tracking

These measures reduce, but do not eliminate, privacy risk. Organizations should evaluate whether the use of Amplitude is appropriate for their environment and compliance requirements.

## Changes to This Policy

This Privacy Policy may be updated to reflect changes to the extension, its tracking implementation, or applicable requirements. The latest version will be published in this repository.

## Contact

For questions or issues related to this extension, please use the GitHub repository:

[https://github.com/ranouf/PublishHtmlTab](https://github.com/ranouf/PublishHtmlTab)
