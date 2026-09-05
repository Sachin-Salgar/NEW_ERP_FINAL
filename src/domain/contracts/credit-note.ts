export const CREDIT_NOTE_PERMISSIONS = {
  read: 'sales.credit_note.read', create: 'sales.credit_note.create', update: 'sales.credit_note.update',
  issue: 'sales.credit_note.issue', cancel: 'sales.credit_note.cancel',
} as const;
export type CreditNotePermission = (typeof CREDIT_NOTE_PERMISSIONS)[keyof typeof CREDIT_NOTE_PERMISSIONS];
export type CreditNoteStatus = 'DRAFT' | 'ISSUED' | 'CANCELLED';
