import { Attachment } from 'azure-devops-extension-api/Build';

/**
 * Groups the attachment lists loaded for a single build context.
 */
export interface AttachmentCollections {
  downloadAttachments: Attachment[];
  fileAttachments: Attachment[];
  summaryAttachments: Attachment[];
}
