export type AuditOutcome = 'success' | 'failure';

export type AuditMetadataValue = string | number | boolean | null;
export type AuditMetadata = Record<string, AuditMetadataValue>;

export interface AuditEvent {
  tenantId: string;
  actorUserId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  outcome: AuditOutcome;
  correlationId?: string | null;
  metadata?: AuditMetadata;
}

export interface AuditRecordOptions {
  /**
   * Require the audit record to participate in an already-active application
   * transaction. Security-critical mutations should use this option so the
   * protected mutation and its audit event share one commit/rollback boundary.
   */
  requireTransaction?: boolean;
}

export interface AuditLogger {
  record(event: AuditEvent, options?: AuditRecordOptions): Promise<void>;
}
