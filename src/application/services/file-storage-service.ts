import { randomUUID } from 'node:crypto';

import type {
  FileMetadataRecord,
  FileMetadataRepository,
  ObjectStorageProvider,
  StructuredPayload,
} from '../contracts/operational-services.js';
import { ForbiddenError, ValidationError } from '../../domain/errors.js';

export interface FileAccessPolicy {
  canRead(input: { tenantId: string; userId: string; file: FileMetadataRecord }): Promise<boolean>;
  canDelete(input: { tenantId: string; userId: string; file: FileMetadataRecord }): Promise<boolean>;
}

export interface CreateUploadInput {
  tenantId: string;
  userId: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  checksumSha256?: string | null;
  metadata?: StructuredPayload;
}

export class FileStorageService {
  constructor(
    private readonly repository: FileMetadataRepository,
    private readonly storage: ObjectStorageProvider,
    private readonly accessPolicy: FileAccessPolicy,
    private readonly options: {
      maxFileSizeBytes?: number;
      transferUrlTtlSeconds?: number;
    } = {},
  ) {}

  async createUpload(input: CreateUploadInput): Promise<{
    file: FileMetadataRecord;
    upload: { url: string; headers?: Record<string, string> };
  }> {
    const maxFileSizeBytes = this.options.maxFileSizeBytes ?? 100 * 1024 * 1024;
    if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes < 0 || input.sizeBytes > maxFileSizeBytes) {
      throw new ValidationError(`File size must be between 0 and ${maxFileSizeBytes} bytes.`);
    }
    if (!input.originalName.trim() || !input.contentType.trim()) {
      throw new ValidationError('File name and content type are required.');
    }

    const fileId = randomUUID();
    const storageKey = buildTenantStorageKey(input.tenantId, fileId, input.originalName);
    const file = await this.repository.create({
      tenantId: input.tenantId,
      ownerUserId: input.userId,
      storageKey,
      originalName: input.originalName,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      checksumSha256: input.checksumSha256 ?? null,
      metadata: input.metadata ?? {},
    });
    const upload = await this.storage.createUploadTarget({
      storageKey,
      contentType: input.contentType,
      expiresInSeconds: this.transferTtlSeconds(),
    });
    return { file, upload };
  }

  async createDownload(
    tenantId: string,
    userId: string,
    fileId: string,
  ): Promise<{ file: FileMetadataRecord; url: string }> {
    const file = await this.repository.getById(tenantId, fileId);
    if (!file) throw new ValidationError('File not found.');
    if (!(await this.accessPolicy.canRead({ tenantId, userId, file }))) {
      throw new ForbiddenError('File access denied.');
    }
    const target = await this.storage.createDownloadTarget({
      storageKey: file.storageKey,
      expiresInSeconds: this.transferTtlSeconds(),
    });
    return { file, url: target.url };
  }

  async softDelete(tenantId: string, userId: string, fileId: string): Promise<boolean> {
    const file = await this.repository.getById(tenantId, fileId);
    if (!file) return false;
    if (!(await this.accessPolicy.canDelete({ tenantId, userId, file }))) {
      throw new ForbiddenError('File deletion denied.');
    }
    return this.repository.softDelete(tenantId, fileId, new Date());
  }

  /** Controlled purge is intentionally separate from soft-delete. */
  async purgeDeleted(file: FileMetadataRecord): Promise<void> {
    await this.storage.deleteObject(file.storageKey);
  }

  private transferTtlSeconds(): number {
    return Math.max(30, Math.min(this.options.transferUrlTtlSeconds ?? 300, 3600));
  }
}

export function buildTenantStorageKey(tenantId: string, fileId: string, originalName: string): string {
  const extensionMatch = /\.([A-Za-z0-9]{1,16})$/.exec(originalName.trim());
  const extension = extensionMatch ? `.${extensionMatch[1]!.toLowerCase()}` : '';
  return `tenants/${tenantId}/files/${fileId}${extension}`;
}
