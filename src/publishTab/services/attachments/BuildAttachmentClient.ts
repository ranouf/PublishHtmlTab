import { getClient } from 'azure-devops-extension-api';
import { Build, BuildRestClient } from 'azure-devops-extension-api/Build';

import {
  DOWNLOAD_ATTACHMENT_TYPE,
  FILE_ATTACHMENT_TYPE,
  SUMMARY_ATTACHMENT_TYPE,
} from '../../constants';
import { AttachmentClient } from './AttachmentClient';

/**
 * Concrete attachment provider backed by Azure DevOps build attachments.
 */
export class BuildAttachmentClient extends AttachmentClient {
  // Concrete gateway that reads PublishTab attachments from an Azure DevOps build.
  private readonly build: Build;

  constructor(build: Build) {
    super();
    this.build = build;
  }

  /**
   * Loads all PublishTab attachment buckets for the current build.
   *
   * @returns {Promise<void>} Resolves when all attachment collections are ready.
   * @throws {Error} Throws when Azure DevOps attachment requests fail.
   */
  public async load(): Promise<void> {
    // Fetch all attachment buckets in parallel to keep startup responsive.
    const buildClient = getClient(BuildRestClient);
    const [summaryAttachments, fileAttachments, downloadAttachments] =
      await Promise.all([
        buildClient.getAttachments(
          this.build.project.id,
          this.build.id,
          SUMMARY_ATTACHMENT_TYPE,
        ),
        buildClient.getAttachments(
          this.build.project.id,
          this.build.id,
          FILE_ATTACHMENT_TYPE,
        ),
        buildClient.getAttachments(
          this.build.project.id,
          this.build.id,
          DOWNLOAD_ATTACHMENT_TYPE,
        ),
      ]);

    this.setAttachments({
      downloadAttachments,
      fileAttachments,
      summaryAttachments,
    });
  }
}
