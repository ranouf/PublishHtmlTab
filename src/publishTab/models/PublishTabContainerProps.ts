import { TrackingPort } from '../domain/tracking';
import { AttachmentClient } from '../services/attachments/AttachmentClient';

/**
 * Defines the dependencies required to render the PublishTab container.
 */
export interface PublishTabContainerProps {
  appVersion: string;
  attachmentClient: AttachmentClient;
  trackingPort: TrackingPort;
  buildId: number;
}
