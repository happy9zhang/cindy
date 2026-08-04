import { describe, expect, it, vi } from 'vitest';

vi.mock('../logger', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));
vi.mock('../imageCacheStore', () => ({ removeSession: vi.fn(async () => undefined) }));
vi.mock('../cindy-media/ledger', () => ({
  removeSessionRefs: vi.fn(async () => 0),
}));
vi.mock('../im/wechat/mediaStaging', () => ({
  removeWechatSessionAttachmentDir: vi.fn(async () => undefined),
}));

import { cleanupDeletedSessionResources } from '../sessionDeletionCleanup';

describe('cleanupDeletedSessionResources', () => {
  it('runs every resource cleanup even when one family fails', async () => {
    const removeLegacyImages = vi.fn(() => {
      throw new Error('locked');
    });
    const removeMediaRefs = vi.fn(async () => 2);
    const removeWechatAttachments = vi.fn(async () => undefined);

    await expect(
      cleanupDeletedSessionResources('session-1', {
        removeLegacyImages,
        removeMediaRefs,
        removeWechatAttachments,
      }),
    ).resolves.toBeUndefined();

    expect(removeLegacyImages).toHaveBeenCalledWith('session-1');
    expect(removeMediaRefs).toHaveBeenCalledWith('session-1');
    expect(removeWechatAttachments).toHaveBeenCalledWith('session-1');
  });
});
