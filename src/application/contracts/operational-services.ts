export type StructuredPayloadValue = string | number | boolean | null | StructuredPayloadValue[] | { [key: string]: StructuredPayloadValue };
export type StructuredPayload = Record<string, StructuredPayloadValue>;

export type NotificationChannel = 'email' | 'in_app';

export interface NotificationRequest {
  tenantId: string;
  userId?: string | null;
  channel: NotificationChannel;
  templateKey: string;
  recipient?: string | null;
  payload: StructuredPayload;
  availableAt?: Date;
}

export interface NotificationServicePort {
  enqueue(request: NotificationRequest): Promise<string>;
}

export interface FileMetadataRecord {
  id: string;
  tenantId: string;
  ownerUserId?: string | null;
  storageKey: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  checksumSha256?: string | null;
  metadata?: StructuredPayload;
}

export interface FileMetadataRepository {
  create(record: Omit<FileMetadataRecord, 'id'>): Promise<FileMetadataRecord>;
  getById(tenantId: string, fileId: string): Promise<FileMetadataRecord | null>;
  softDelete(tenantId: string, fileId: string, deletedAt: Date): Promise<boolean>;
}

export interface ObjectStorageProvider {
  createUploadTarget(input: { storageKey: string; contentType: string; expiresInSeconds: number }): Promise<{ url: string; headers?: Record<string, string> }>;
  createDownloadTarget(input: { storageKey: string; expiresInSeconds: number }): Promise<{ url: string }>;
  deleteObject(storageKey: string): Promise<void>;
}

export interface ScheduledJobRequest {
  tenantId: string;
  jobType: string;
  payload: StructuredPayload;
  scheduleKind: 'once' | 'recurring';
  cronExpression?: string | null;
  timezone?: string;
  nextRunAt: Date;
  maxAttempts?: number;
}

export interface SchedulerServicePort {
  schedule(request: ScheduledJobRequest): Promise<string>;
  cancel(tenantId: string, jobId: string): Promise<boolean>;
}

export interface DomainEvent {
  tenantId: string;
  aggregateType: string;
  aggregateId: string;
  eventName: string;
  eventVersion: number;
  payload: StructuredPayload;
  correlationId?: string | null;
  occurredAt?: Date;
}

export interface DomainEventPublisher {
  publish(event: DomainEvent): Promise<string>;
}
