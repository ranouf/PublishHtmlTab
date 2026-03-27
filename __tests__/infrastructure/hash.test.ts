import { hashValue } from '../../src/publishTab/infrastructure/analytics/hash';

describe('hashValue', () => {
  it('returns a stable short hash for one input', async () => {
    await expect(hashValue('coverage/index.html')).resolves.toBe(
      await hashValue('coverage/index.html'),
    );
  });

  it('returns different hashes for different inputs', async () => {
    const left = await hashValue('coverage/index.html');
    const right = await hashValue('details/index.html');

    expect(left).not.toBe(right);
    expect(left).toHaveLength(16);
    expect(right).toHaveLength(16);
  });
});
