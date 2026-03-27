import * as SDK from 'azure-devops-extension-sdk';

import { HostNavigationService } from '../../src/publishTab/services/navigation/HostNavigationService';
import {
  HOST_REPORT_QUERY_KEY,
  HOST_SUMMARY_QUERY_KEY,
} from '../../src/publishTab/constants';

jest.mock('azure-devops-extension-sdk', () => ({
  getService: jest.fn(),
}));

describe('HostNavigationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns query params from the Azure DevOps host service', async () => {
    (SDK.getService as jest.Mock).mockResolvedValue({
      getQueryParams: jest.fn().mockResolvedValue({ foo: 'bar' }),
    });

    const service = new HostNavigationService();

    await expect(service.getQueryParams()).resolves.toEqual({ foo: 'bar' });
  });

  it('returns an empty object when query param retrieval fails', async () => {
    (SDK.getService as jest.Mock).mockRejectedValue(new Error('Host failure'));

    const service = new HostNavigationService();

    await expect(service.getQueryParams()).resolves.toEqual({});
  });

  it('syncs the selected report and caches the host service instance', async () => {
    const hostNavigationService = {
      getQueryParams: jest.fn(),
      setQueryParams: jest.fn(),
    };
    (SDK.getService as jest.Mock).mockResolvedValue(hostNavigationService);

    const service = new HostNavigationService();
    await service.syncReportSelection('report.html', 'summary.json');
    await service.syncReportSelection('details.html', 'summary.json');

    expect(SDK.getService).toHaveBeenCalledTimes(1);
    expect(hostNavigationService.setQueryParams).toHaveBeenCalledWith({
      [HOST_REPORT_QUERY_KEY]: 'report.html',
      [HOST_SUMMARY_QUERY_KEY]: 'summary.json',
    });
    expect(hostNavigationService.setQueryParams).toHaveBeenCalledWith({
      [HOST_REPORT_QUERY_KEY]: 'details.html',
      [HOST_SUMMARY_QUERY_KEY]: 'summary.json',
    });
  });

  it('does nothing when the selected report attachment name is empty', async () => {
    const service = new HostNavigationService();

    await service.syncReportSelection('', 'summary.json');

    expect(SDK.getService).not.toHaveBeenCalled();
  });

  it('swallows host navigation errors while syncing the selection', async () => {
    (SDK.getService as jest.Mock).mockRejectedValue(new Error('Host failure'));

    const service = new HostNavigationService();

    await expect(
      service.syncReportSelection('report.html', 'summary.json'),
    ).resolves.toBeUndefined();
  });
});
