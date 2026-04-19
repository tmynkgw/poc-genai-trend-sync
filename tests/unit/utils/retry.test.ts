import { describe, it, expect, vi } from 'vitest';
import { withRetry } from '../../../src/utils/retry.js';
import { InfraError } from '../../../src/domain/errors.js';

describe('withRetry', () => {
  it('成功した場合はそのまま値を返す', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, 2);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('InfraError の場合は maxRetries 回までリトライする', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new InfraError('fail'))
      .mockRejectedValueOnce(new InfraError('fail'))
      .mockResolvedValue('ok');

    const result = await withRetry(fn, 2, 0);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('maxRetries を超えた場合は最後のエラーを投げる', async () => {
    const fn = vi.fn().mockRejectedValue(new InfraError('persistent fail'));
    await expect(withRetry(fn, 2, 0)).rejects.toThrow('persistent fail');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('InfraError 以外のエラーはリトライせずに即座に投げる', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('non-infra error'));
    await expect(withRetry(fn, 2, 0)).rejects.toThrow('non-infra error');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
