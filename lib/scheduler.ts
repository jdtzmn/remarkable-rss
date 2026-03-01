import cron, { ScheduledTask } from "node-cron";
import UserModel from "../models/user";

// Lazy import to avoid circular dependency at module load time
async function getRunDigestForUser() {
  const { runDigestForUser } = await import("../pages/api/fetch/index");
  return runDigestForUser;
}

const tasks = new Map<string, ScheduledTask>();

/**
 * Initialize the scheduler: load all users with cronEnabled and schedule them.
 */
export async function initScheduler(): Promise<void> {
  const users = await UserModel.find({ cronEnabled: true });

  for (const user of users) {
    scheduleUser(user._id.toString(), user.cronSchedule);
  }

  console.log(`[Scheduler] Initialized ${tasks.size} cron job(s)`);
}

/**
 * Schedule or reschedule a cron job for a specific user.
 */
export function scheduleUser(userId: string, cronExpression: string): void {
  // Remove existing task if any
  const existing = tasks.get(userId);
  if (existing) {
    existing.stop();
    tasks.delete(userId);
  }

  if (!cron.validate(cronExpression)) {
    console.error(
      `[Scheduler] Invalid cron expression for user ${userId}: ${cronExpression}`
    );
    return;
  }

  const task = cron.schedule(cronExpression, async () => {
    console.log(`[Scheduler] Running digest for user ${userId}`);
    try {
      const user = await UserModel.findById(userId);
      if (!user || !user.cronEnabled || !user.deviceToken) {
        console.log(`[Scheduler] Skipping user ${userId} (disabled or no device token)`);
        return;
      }
      const runDigest = await getRunDigestForUser();
      await runDigest(user);
      console.log(`[Scheduler] Digest completed for user ${userId}`);
    } catch (e) {
      console.error(`[Scheduler] Digest failed for user ${userId}:`, e);
    }
  });

  tasks.set(userId, task);
  console.log(`[Scheduler] Scheduled user ${userId} with "${cronExpression}"`);
}

/**
 * Update or remove a user's schedule.
 */
export function updateSchedule(
  userId: string,
  cronExpression: string,
  enabled: boolean
): void {
  if (!enabled) {
    const existing = tasks.get(userId);
    if (existing) {
      existing.stop();
      tasks.delete(userId);
      console.log(`[Scheduler] Removed schedule for user ${userId}`);
    }
    return;
  }

  scheduleUser(userId, cronExpression);
}

/**
 * Stop all scheduled tasks (for graceful shutdown).
 */
export function stopAll(): void {
  tasks.forEach((task, userId) => {
    task.stop();
    console.log(`[Scheduler] Stopped task for user ${userId}`);
  });
  tasks.clear();
}
