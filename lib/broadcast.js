import { getBroadcastRecipients, getNextBroadcastJob, updateBroadcastJob } from '@/lib/db';
import { sendMessage } from '@/lib/telegram';

export async function processNextBroadcastBatch(limit = 200) {
  const job = await getNextBroadcastJob();
  if (!job) {
    return { ok: true, message: 'Tidak ada broadcast queued.', sent: 0, failed: 0 };
  }

  await updateBroadcastJob(job.id, { status: 'running' });

  const recipients = await getBroadcastRecipients(job.last_user_cursor || 0, limit);
  if (!recipients.length) {
    await updateBroadcastJob(job.id, { status: 'done', finished_at: new Date().toISOString() });
    return { ok: true, message: 'Broadcast selesai.', sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;
  let lastCursor = job.last_user_cursor || 0;

  for (const recipient of recipients) {
    try {
      await sendMessage(recipient.tg_user_id, job.message, {
        parse_mode: job.parse_mode,
        disable_web_page_preview: true
      });
      sent += 1;
    } catch {
      failed += 1;
    }
    lastCursor = recipient.tg_user_id;
  }

  const isFinished = recipients.length < limit;
  await updateBroadcastJob(job.id, {
    sent_count: Number(job.sent_count || 0) + sent,
    failed_count: Number(job.failed_count || 0) + failed,
    last_user_cursor: lastCursor,
    status: isFinished ? 'done' : 'running',
    finished_at: isFinished ? new Date().toISOString() : null
  });

  return {
    ok: true,
    message: isFinished ? 'Broadcast selesai.' : 'Batch broadcast selesai diproses.',
    sent,
    failed,
    jobId: job.id
  };
}
