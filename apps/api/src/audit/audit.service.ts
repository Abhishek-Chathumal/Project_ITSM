import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface RecordAuditEntryInput {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  diff?: unknown;
  ipAddress?: string | null;
}

/**
 * Append-only audit writer (Article IV). Deliberately exposes no update/delete
 * method — the AuditLog table is immutable at the application layer. Every other
 * module that mutates state calls `record()` here rather than writing AuditLog rows
 * itself, so this is the single place the "immutable, append-only" guarantee lives.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: RecordAuditEntryInput) {
    await this.prisma.auditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        diff: entry.diff as never,
        ipAddress: entry.ipAddress ?? null,
      },
    });
  }

  async list(params: { skip?: number; take?: number }) {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      skip: params.skip ?? 0,
      take: params.take ?? 50,
    });
  }
}
