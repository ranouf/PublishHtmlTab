import { AnalyticsTracker } from '../domain/analytics';
import { AttachmentClient } from '../services/attachments/AttachmentClient';

/**
 * Defines the dependencies required to render the PublishTab container.
 */
export interface PublishTabContainerProps {
  appVersion: string;
  attachmentClient: AttachmentClient;
  analyticsTracker: AnalyticsTracker;
  buildId: number;
}
