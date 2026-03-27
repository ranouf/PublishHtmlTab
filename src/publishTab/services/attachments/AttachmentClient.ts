import * as SDK from 'azure-devops-extension-sdk';

import { Attachment } from 'azure-devops-extension-api/Build';

import { AttachmentCollections, ReportManifest } from '../../models';

/**
 * Base service that exposes PublishTab attachments through a consistent API.
 */
export abstract class AttachmentClient {
  // Base gateway shared by build-specific attachment providers.
  private summaryAttachments: Attachment[] = [];
  private fileAttachments: Attachment[] = [];
  private downloadAttachments: Attachment[] = [];
  private authRequestInit?: RequestInit;
  private readonly manifestCache = new Map<string, ReportManifest>();

  /**
   * Stores the attachment collections loaded by a concrete provider.
   *
   * @param {AttachmentCollections} attachments - Attachment groups for the active build.
   * @returns {void} Does not return a value.
   */
  protected setAttachments(attachments: AttachmentCollections): void {
    this.summaryAttachments = attachments.summaryAttachments;
    this.fileAttachments = attachments.fileAttachments;
    this.downloadAttachments = attachments.downloadAttachments;
  }

  /**
   * Returns summary attachments for the active build.
   *
   * @returns {Attachment[]} Summary attachments exposed by the build.
   */
  public getSummaryAttachments(): Attachment[] {
    return this.summaryAttachments;
  }

  /**
   * Returns legacy report attachments for the active build.
   *
   * @returns {Attachment[]} Legacy report attachments exposed by the build.
   */
  public getLegacyAttachments(): Attachment[] {
    return this.summaryAttachments;
  }

  /**
   * Indicates whether the current build exposes manifest-driven report files.
   *
   * @returns {boolean} `true` when manifest and file attachments are both available.
   */
  public hasManifestMode(): boolean {
    return (
      this.summaryAttachments.length > 0 && this.fileAttachments.length > 0
    );
  }

  /**
   * Loads and caches a parsed report manifest attachment.
   *
   * @param {string} attachmentName - Summary attachment name that stores the manifest JSON.
   * @returns {Promise<ReportManifest>} Parsed manifest for the requested summary attachment.
   * @throws {Error} Throws when the attachment cannot be downloaded or parsed.
   */
  public async getManifest(attachmentName: string): Promise<ReportManifest> {
    // Cache parsed manifests so tab switches do not refetch the same JSON.
    if (!this.manifestCache.has(attachmentName)) {
      const manifestText = await this.getAttachmentContent(
        this.summaryAttachments,
        attachmentName,
      );
      this.manifestCache.set(
        attachmentName,
        JSON.parse(manifestText) as ReportManifest,
      );
    }

    return this.manifestCache.get(attachmentName) as ReportManifest;
  }

  /**
   * Downloads the HTML or asset content for a report attachment.
   *
   * @param {string} attachmentName - Attachment name to download.
   * @returns {Promise<string>} Raw attachment body as text.
   * @throws {Error} Throws when the attachment cannot be downloaded.
   */
  public async getReportContent(attachmentName: string): Promise<string> {
    const sourceAttachments = this.hasManifestMode()
      ? this.fileAttachments
      : this.summaryAttachments;
    return this.getAttachmentContent(sourceAttachments, attachmentName);
  }

  /**
   * Returns the direct download URL for a report attachment.
   *
   * @param {string} attachmentName - Attachment name to resolve.
   * @returns {string} Download URL exposed by Azure DevOps.
   * @throws {Error} Throws when the attachment cannot be downloaded.
   */
  public getReportUrl(attachmentName: string): string {
    const sourceAttachments = this.hasManifestMode()
      ? this.fileAttachments
      : this.summaryAttachments;
    return this.getDownloadableAttachment(sourceAttachments, attachmentName)
      ._links.self.href;
  }

  /**
   * Downloads the archive attachment and triggers a browser download.
   *
   * @param {string} attachmentName - Archive attachment name to download.
   * @param {string} fileName - File name suggested to the browser.
   * @returns {Promise<void>} Resolves when the browser download has been triggered.
   * @throws {Error} Throws when the archive cannot be downloaded.
   */
  public async downloadReportArchive(
    attachmentName: string,
    fileName: string,
  ): Promise<void> {
    const response = await this.getAttachmentResponse(
      this.downloadAttachments,
      attachmentName,
    );
    const archiveBlob = await response.blob();
    const downloadUrl = URL.createObjectURL(archiveBlob);
    const downloadLink = document.createElement('a');

    downloadLink.href = downloadUrl;
    downloadLink.download = fileName;
    downloadLink.click();

    URL.revokeObjectURL(downloadUrl);
  }

  /**
   * Resolves an attachment that exposes a downloadable URL.
   *
   * @param {Attachment[]} attachments - Attachment list to search in.
   * @param {string} attachmentName - Attachment name to resolve.
   * @returns {Attachment} Matching downloadable attachment.
   * @throws {Error} Throws when the attachment is missing or not downloadable.
   */
  protected getDownloadableAttachment(
    attachments: Attachment[],
    attachmentName: string,
  ): Attachment {
    const attachment = attachments.find(
      (candidate) => candidate.name === attachmentName,
    );

    if (!attachment?._links?.self?.href) {
      throw new Error(`Attachment ${attachmentName} is not downloadable`);
    }

    return attachment;
  }

  /**
   * Downloads an attachment as a `Response` object.
   *
   * @param {Attachment[]} attachments - Attachment list to search in.
   * @param {string} attachmentName - Attachment name to download.
   * @returns {Promise<Response>} Fetch response for the requested attachment.
   * @throws {Error} Throws when the attachment is missing or the request fails.
   */
  protected async getAttachmentResponse(
    attachments: Attachment[],
    attachmentName: string,
  ): Promise<Response> {
    // Reuse the same auth header for all attachment requests in this session.
    if (!this.authRequestInit) {
      const accessToken = await SDK.getAccessToken();
      this.authRequestInit = {
        headers: {
          Authorization: `Basic ${this.toBase64(`:${accessToken}`)}`,
        },
      };
    }

    const attachment = this.getDownloadableAttachment(
      attachments,
      attachmentName,
    );
    const response = await fetch(
      attachment._links.self.href,
      this.authRequestInit,
    );

    if (!response.ok) {
      throw new Error(response.statusText);
    }

    return response;
  }

  /**
   * Downloads an attachment body as text.
   *
   * @param {Attachment[]} attachments - Attachment list to search in.
   * @param {string} attachmentName - Attachment name to download.
   * @returns {Promise<string>} Attachment body as text.
   * @throws {Error} Throws when the attachment request fails.
   */
  protected async getAttachmentContent(
    attachments: Attachment[],
    attachmentName: string,
  ): Promise<string> {
    const response = await this.getAttachmentResponse(
      attachments,
      attachmentName,
    );
    return response.text();
  }

  /**
   * Encodes a string to base64 using UTF-8 bytes.
   *
   * @param {string} value - Raw string to encode.
   * @returns {string} Base64-encoded string.
   */
  private toBase64(value: string): string {
    // Azure DevOps expects the PAT-style ":token" string encoded as base64.
    const bytes = new TextEncoder().encode(value);
    let binary = '';

    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });

    return btoa(binary);
  }
}
