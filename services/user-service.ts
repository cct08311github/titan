import { PrismaClient, Role } from "@prisma/client";
import { hash } from "bcryptjs";
import { NotFoundError, ValidationError } from "./errors";
import { AuditService } from "./audit-service";
import { JwtBlacklist } from "@/lib/jwt-blacklist";

export interface ListUsersFilter {
  role?: Role | string;
  isActive?: boolean;
  includeSuspended?: boolean;
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role?: Role | string;
  avatar?: string;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  password?: string;
  role?: Role | string;
  avatar?: string | null;
  isActive?: boolean;
  updatedBy?: string;
  ipAddress?: string;
}

export class UserService {
  private readonly auditor: AuditService;

  constructor(private readonly prisma: PrismaClient) {
    this.auditor = new AuditService(prisma);
  }

  async listUsers(filter: ListUsersFilter) {
    const where: Record<string, unknown> = {};
    if (filter.role) where.role = filter.role;
    // By default exclude suspended (isActive = false)
    // unless caller explicitly opts in with includeSuspended
    if (!filter.includeSuspended) {
      where.isActive = true;
    }

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

  async createUser(input: CreateUserInput) {
    if (!input.name?.trim()) {
      throw new ValidationError("姓名為必填");
    }
    if (!input.email?.trim()) {
      throw new ValidationError("電子郵件為必填");
    }

    // Check for duplicate email
    const existing = await this.prisma.user.findUnique({
      where: { email: input.email },
    });
    if (existing) {
      throw new ValidationError(`Email already in use: ${input.email}`);
    }

    const passwordHash = await hash(input.password, 12);

    return this.prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        password: passwordHash,
        role: (input.role ?? "ENGINEER") as Role,
        avatar: input.avatar ?? null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatar: true,
        isActive: true,
        createdAt: true,
      },
    });
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
    if (input.password !== undefined) {
      updates.password = await hash(input.password, 12);
      updates.passwordChangedAt = new Date();
      updates.mustChangePassword = false;
    }

    const updated = await this.prisma.user.update({
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

    // Issue #191: record before/after diff for all changes (ISO 27001 A.12.4.1)
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    if (input.name !== undefined && input.name !== existing.name)
      changes.name = { from: existing.name, to: input.name };
    if (input.email !== undefined && input.email !== existing.email)
      changes.email = { from: existing.email, to: input.email };
    if (input.role !== undefined && input.role !== existing.role)
      changes.role = { from: existing.role, to: input.role };
    if (input.isActive !== undefined && input.isActive !== existing.isActive)
      changes.isActive = { from: existing.isActive, to: input.isActive };
    if (input.password !== undefined)
      changes.password = { from: "[redacted]", to: "[changed]" };
    if (input.avatar !== undefined && input.avatar !== existing.avatar)
      changes.avatar = { from: existing.avatar ? "[had avatar]" : null, to: input.avatar ? "[new avatar]" : null };

    if (Object.keys(changes).length > 0) {
      const action = input.role !== undefined && input.role !== existing.role
        ? "ROLE_CHANGE"
        : input.password !== undefined
        ? "PASSWORD_CHANGE"
        : "USER_UPDATE";

      await this.auditor.log({
        userId: input.updatedBy ?? null,
        action,
        resourceType: "User",
        resourceId: id,
        detail: JSON.stringify({ changes }),
        ipAddress: input.ipAddress ?? null,
      });
    }

    return updated;
  }

  async suspendUser(id: string) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError(`User not found: ${id}`);

    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    // Blacklist all JWTs for this user so in-flight tokens are immediately
    // rejected by withJwtBlacklist middleware — Issue #153.
    JwtBlacklist.add(`user:${id}`);

    return updated;
  }

  async unsuspendUser(id: string) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError(`User not found: ${id}`);

    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    // Remove the userId-based blacklist key so the user's tokens are
    // accepted again by withJwtBlacklist middleware — Issue #164.
    JwtBlacklist.remove(`user:${id}`);

    return updated;
  }
}
