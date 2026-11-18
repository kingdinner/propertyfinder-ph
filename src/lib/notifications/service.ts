import { and, desc, eq, isNull } from "drizzle-orm";
import { notifications, users } from "@/db/schema";
import type { Database } from "@/db/client";
import { getDb } from "@/db/client";
import { sendEmail } from "@/lib/email";

export async function notifyUser(
  db: Database,
  input: {
    userId: string;
    title: string;
    body: string;
    entityType?: string;
    entityId?: string;
    email?: boolean;
  },
) {
  await db.insert(notifications).values({
    userId: input.userId,
    channel: "in_app",
    title: input.title,
    body: input.body,
    entityType: input.entityType,
    entityId: input.entityId,
  });

  if (!input.email) return;

  const [user] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
  if (!user) return;
  await sendEmail({ to: user.email, subject: input.title, text: input.body });
  await db.insert(notifications).values({
    userId: input.userId,
    channel: "email",
    title: input.title,
    body: input.body,
    entityType: input.entityType,
    entityId: input.entityId,
  });
}

export async function listNotificationsForUser(userId: string, db: Database = getDb()) {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(50);
}

export async function markNotificationRead(userId: string, notificationId: string, db: Database = getDb()) {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId), isNull(notifications.readAt)));
}
