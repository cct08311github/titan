import { PrismaClient, Role } from "@prisma/client";
import { NotFoundError, ValidationError } from "./errors";

export interface ListUsersFilter {
  role?: Role | string;
  isActive?: boolean;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  role?: Role | string;
  avatar?: string | null;
  isActive?: boolean;
}

export class UserService {
  constructor(private readonly prisma: PrismaClient) {}

  async listUsers(filter: ListUsersFilter) {
    const where: Record<string, unknown> = {};
    if (filter.role) where.role = filter.role;
    if (filter.isActive !== undefined) where.isActive = filter.isActive;

    return this.prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatar: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { name: "asc" },
    });
  }

  async getUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatar: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) throw new NotFoundError(`User not found: ${id}`);
    return user;
  }

  async updateUser(id: string, input: UpdateUserInput) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError(`User not found: ${id}`);

    // Validate email uniqueness
    if (input.email && input.email !== existing.email) {
      const conflict = await this.prisma.user.findUnique({
        where: { email: input.email },
      });
      if (conflict) {
        throw new ValidationError(`Email already in use: ${input.email}`);
      }
    }

    const updates: Record<string, unknown> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.email !== undefined) updates.email = input.email;
    if (input.role !== undefined) updates.role = input.role;
    if (input.avatar !== undefined) updates.avatar = input.avatar;
    if (input.isActive !== undefined) updates.isActive = input.isActive;

    return this.prisma.user.update({
      where: { id },
      data: updates,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatar: true,
        isActive: true,
      },
    });
  }
}
