import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { WorkflowService } from '../../src/application/services/workflow-service.js';
import type { WorkflowRepository } from '../../src/domain/contracts/workflow.js';

const context = {
  tenantId: randomUUID(),
  branchId: randomUUID(),
  financialYearId: randomUUID(),
  userId: randomUUID(),
};

function service(repository: WorkflowRepository, transition = vi.fn()) {
  return {
    service: new WorkflowService(
      repository,
      { record: vi.fn() },
      { runInTransaction: async <T>(callback: () => Promise<T>) => callback() },
      { transitionPurchaseOrder: transition },
    ),
    transition,
  };
}

describe('WorkflowService generic document integration', () => {
  it('leaves an unconfigured branch submission in Procurement control', async () => {
    const transition = vi.fn().mockResolvedValue({ id: 'po', status: 'APPROVED' });
    const { service: workflow } = service({
      getActiveDefinition: vi.fn().mockResolvedValue(null),
    } as unknown as WorkflowRepository, transition);

    await expect(workflow.onDocumentSubmitted(context, 'PROCUREMENT.PURCHASE_ORDER', 'po', 2, 'submit-key')).resolves.toEqual({ status: 'SUBMITTED' });
    expect(transition).not.toHaveBeenCalled();
  });

  it('creates a new workflow instance for an approval-required document submission', async () => {
    const definition = {
      id: randomUUID(),
      versionId: randomUUID(),
      tenantId: context.tenantId,
      branchId: context.branchId,
      documentType: 'PROCUREMENT.PURCHASE_ORDER' as const,
      name: 'PO approval',
      version: 1,
      status: 'ACTIVE' as const,
      approvalRequired: true,
      allowCorrection: true,
      allowDelegation: true,
      escalationAfterMinutes: null,
      levels: [],
      effectiveFrom: null,
      effectiveTo: null,
    };
    const createInstance = vi.fn().mockResolvedValue({ id: randomUUID(), status: 'RUNNING', version: 1, documentType: 'PROCUREMENT.PURCHASE_ORDER', documentId: 'po', documentVersion: 2 });
    const { service: workflow } = service({
      getActiveDefinition: vi.fn().mockResolvedValue(definition),
      createInstance,
    } as unknown as WorkflowRepository);

    await expect(workflow.onDocumentSubmitted(context, 'PROCUREMENT.PURCHASE_ORDER', 'po', 2, 'submit-key')).resolves.toEqual({ status: 'RUNNING' });
    expect(createInstance).toHaveBeenCalledWith(context, definition, 'PROCUREMENT.PURCHASE_ORDER', 'po', 2, 'submit-key');
  });

  it('approves a submitted document when the active branch policy disables approval', async () => {
    const transition = vi.fn().mockResolvedValue({ id: 'po', status: 'APPROVED' });
    const { service: workflow } = service({
      getActiveDefinition: vi.fn().mockResolvedValue({
        tenantId: context.tenantId,
        branchId: context.branchId,
        documentType: 'PROCUREMENT.PURCHASE_ORDER',
        name: 'No approval',
        id: randomUUID(),
        versionId: randomUUID(),
        version: 1,
        status: 'ACTIVE',
        approvalRequired: false,
        allowCorrection: false,
        allowDelegation: false,
        escalationAfterMinutes: null,
        levels: [],
        effectiveFrom: null,
        effectiveTo: null,
      }),
    } as unknown as WorkflowRepository, transition);

    await expect(workflow.onDocumentSubmitted(context, 'PROCUREMENT.PURCHASE_ORDER', 'po', 2, 'submit-key')).resolves.toEqual({ status: 'APPROVED' });
    expect(transition).toHaveBeenCalledWith(context, { id: 'po', status: 'APPROVED', expectedVersion: 2 });
  });

  it('delegates rejection and approval transitions to Procurement using generic document metadata', async () => {
    const transition = vi.fn().mockResolvedValue({ id: 'po', status: 'REJECTED' });
    const { service: workflow } = service({
      decide: vi.fn().mockResolvedValue({
        status: 'REJECTED',
        documentType: 'PROCUREMENT.PURCHASE_ORDER',
        documentId: 'po',
        documentVersion: 3,
        documentStatus: 'REJECTED',
      }),
    } as unknown as WorkflowRepository, transition);

    await workflow.decideDocument(context, 'instance', 'task', 'REJECT', 1, 'decision-key');
    expect(transition).toHaveBeenCalledWith(context, { id: 'po', status: 'REJECTED', expectedVersion: 3 });
  });
});
