import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { validateBody } from "@/lib/validate";
import { createDocCommentSchema } from "@/validators/knowledge-validators";
import { success } from "@/lib/api-response";
import { NotFoundError } from "@/services/errors";
import { publishNotifications } from "@/lib/notification-publisher";

export const GET = withAuth(async (
  _req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context.params;

  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) throw new NotFoundError("文件不存在");

  const comments = await prisma.documentComment.findMany({
    where: { documentId: id, parentId: null },
    include: {
      author: { select: { id: true, name: true, avatar: true } },
      replies: {
        include: {
          author: { select: { id: true, name: true, avatar: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return success(comments);
});

export const POST = withAuth(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await requireAuth();
  const { id } = await context.params;
  const raw = await req.json();
  const body = validateBody(createDocCommentSchema, raw);

  const doc = await prisma.document.findUnique({
    where: { id },
    select: { id: true, title: true },
  });
  if (!doc) throw new NotFoundError("文件不存在");

  if (body.parentId) {
    const parent = await prisma.documentComment.findFirst({
      where: { id: body.parentId, documentId: id },
    });
    if (!parent) throw new NotFoundError("父評論不存在");
  }

  // Issue #1506: resolve + validate mentioned users before tx.
  const candidateIds = Array.from(
    new Set((body.mentionedUserIds ?? []).filter((uid) => uid !== session.user.id))
  );
  const activeMentioned =
    candidateIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: candidateIds }, isActive: true },
          select: { id: true },
        })
      : [];
  const mentionedIds = activeMentioned.map((u) => u.id);

  const { comment, notifications } = await prisma.$transaction(async (tx) => {
    const created = await tx.documentComment.create({
      data: {
        documentId: id,
        authorId: session.user.id,
        content: body.content,
        parentId: body.parentId ?? null,
      },
      include: {
        author: { select: { id: true, name: true, avatar: true } },
      },
    });

    if (mentionedIds.length === 0) {
      return { comment: created, notifications: [] };
    }

    const optedOut = await tx.notificationPreference.findMany({
      where: { userId: { in: mentionedIds }, type: "MENTION", enabled: false },
      select: { userId: true },
    });
    const optedOutSet = new Set(optedOut.map((p) => p.userId));
    const targets = mentionedIds.filter((uid) => !optedOutSet.has(uid));

    if (targets.length === 0) {
      return { comment: created, notifications: [] };
    }

    const preview = body.content.substring(0, 140);
    const title = `${created.author.name} 在文件「${doc.title}」中提到你`;

    const createdNotifications = await Promise.all(
      targets.map((uid) =>
        tx.notification.create({
          data: {
            userId: uid,
            type: "MENTION",
            title,
            body: preview,
            relatedId: id,
            relatedType: "Document",
          },
        })
      )
    );

    return { comment: created, notifications: createdNotifications };
  });

  if (notifications.length > 0) {
    try {
      const publishPromise = publishNotifications(
        notifications.map((n) => ({
          id: n.id,
          userId: n.userId,
          type: n.type,
          title: n.title,
          body: n.body,
          isRead: n.isRead,
          createdAt: n.createdAt,
          relatedId: n.relatedId,
          relatedType: n.relatedType,
        }))
      );
      void Promise.resolve(publishPromise).catch(() => undefined);
    } catch {
      // Sync throw from publisher — ignore, comment already persisted.
    }
  }

  return success(comment, 201);
});
