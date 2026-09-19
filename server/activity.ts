import prisma from "./db";

type ActivityInput = {
  userId: string;
  action: string;
  entity: string;
  entityId?: string;
  detail: string;
};

export async function logActivity(input: ActivityInput) {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { name: true, email: true },
  });
  const label = [user?.name, user?.email].filter(Boolean).join(" - ");
  await prisma.activityLog.create({
    data: {
      userId: input.userId,
      userLabel: label || null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      detail: input.detail,
    },
  });
}