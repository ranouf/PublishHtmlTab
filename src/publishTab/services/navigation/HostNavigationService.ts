import * as SDK from 'azure-devops-extension-sdk';

import {
  CommonServiceIds,
  IHostNavigationService,
} from 'azure-devops-extension-api/Common/CommonServices';

import { HOST_REPORT_QUERY_KEY, HOST_SUMMARY_QUERY_KEY } from '../../constants';

/**
 * Small wrapper around the Azure DevOps host navigation service.
 */
export class HostNavigationService {
  // Thin wrapper around the host navigation API to keep controller code focused.
  private hostNavigationServicePromise?: Promise<IHostNavigationService>;

  /**
   * Reads the current host query parameters.
   *
   * @returns {Promise<Record<string, string>>} Current host query string as a key/value object.
   */
  public async getQueryParams(): Promise<Record<string, string>> {
    try {
      const hostNavigationService = await this.getHostNavigationService();
      return (await hostNavigationService.getQueryParams()) as Record<
        string,
        string
      >;
    } catch {
      return {};
    }
  }

  /**
   * Persists the selected report and summary attachments into the host URL.
   *
   * @param {string} reportAttachmentName - Active report attachment name.
   * @param {string} summaryAttachmentName - Active summary attachment name.
   * @returns {Promise<void>} Resolves when the query state has been updated.
   */
  public async syncReportSelection(
    reportAttachmentName: string,
    summaryAttachmentName: string,
  ): Promise<void> {
    if (!reportAttachmentName) {
      return;
    }

    try {
      // Mirror the current selection into the host URL so refresh/back keeps context.
      const hostNavigationService = await this.getHostNavigationService();
      hostNavigationService.setQueryParams({
        [HOST_REPORT_QUERY_KEY]: reportAttachmentName,
        [HOST_SUMMARY_QUERY_KEY]: summaryAttachmentName || '',
      });
    } catch {
      return;
    }
  }

  /**
   * Lazily resolves the Azure DevOps host navigation service instance.
   *
   * @returns {Promise<IHostNavigationService>} Host navigation service promise.
   */
  private getHostNavigationService(): Promise<IHostNavigationService> {
    if (!this.hostNavigationServicePromise) {
      this.hostNavigationServicePromise =
        SDK.getService<IHostNavigationService>(
          CommonServiceIds.HostNavigationService,
        );
    }

    return this.hostNavigationServicePromise;
  }
}
