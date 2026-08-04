/**
 * Best-effort cleanup for resources owned by a permanently deleted session.
 *
 * The caller is responsible for proving that the session is still deleted.
 * Each resource family is isolated so one filesystem or ledger failure cannot
 * prevent the remaining cleanup work from running.
 */

import * as imageCacheStore from './imageCacheStore';
import { removeSessionRefs as removeSessionMediaRefs } from './cindy-media/ledger';
import { removeWechatSessionAttachmentDir } from './im/wechat/mediaStaging';
import { createLogger } from './logger';

const log = createLogger('session-deletion-cleanup');

export interface SessionDeletionCleanupDependencies {
  removeLegacyImages(sessionId: string): Promise<void>;
  removeMediaRefs(sessionId: string): Promise<number>;
  removeWechatAttachments(sessionId: string): Promise<void>;
}

const productionDependencies: SessionDeletionCleanupDependencies = {
  removeLegacyImages: (sessionId) => imageCacheStore.removeSession(sessionId),
  removeMediaRefs: (sessionId) => removeSessionMediaRefs(sessionId),
  removeWechatAttachments: (sessionId) => removeWechatSessionAttachmentDir(sessionId),
};

export async function cleanupDeletedSessionResources(
  sessionId: string,
  dependencies: SessionDeletionCleanupDependencies = productionDependencies,
): Promise<void> {
  const tasks = [
    {
      name: 'legacy image cache',
      run: () => dependencies.removeLegacyImages(sessionId),
    },
    {
      name: 'media refs',
      run: async () => {
        const count = await dependencies.removeMediaRefs(sessionId);
        if (count > 0) log.info('session media refs removed', { sessionId, count });
      },
    },
    {
      name: 'WeChat attachments',
      run: () => dependencies.removeWechatAttachments(sessionId),
    },
  ];
  const results = await Promise.allSettled(
    tasks.map((task) => Promise.resolve().then(() => task.run())),
  );
  for (const [index, result] of results.entries()) {
    if (result.status === 'fulfilled') continue;
    log.warn('deleted session resource cleanup failed', {
      sessionId,
      resource: tasks[index].name,
      error: result.reason instanceof Error ? result.reason.message : String(result.reason),
    });
  }
}
