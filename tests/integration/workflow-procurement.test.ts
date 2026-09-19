import { afterAll, describe, expect, it } from 'vitest';
import { v7 as uuidV7 } from 'uuid';
import { closeFixture, fixture, headers, login } from './authorization-proof-fixtures.js';

describe('Canonical workflow integration for procurement', () => {
  let value: Awaited<ReturnType<typeof fixture>>;

  afterAll(async () => {
    if (value) await closeFixture(value);
  });

  it('routes procurement approval through the canonical workflow engine and removes legacy approval endpoints', async () => {
    value = await fixture();
    const token = await login(value.app, value.tenantASeed, value.tenantA.tenantId);
    const auth = headers(token, value.tenantA.tenantId);

    const role = (
      await value.adminPool.query(
        `SELECT r.id FROM roles r
         JOIN user_roles ur ON ur.role_id=r.id AND ur.tenant_id=r.tenant_id
         JOIN users u ON u.id=ur.user_id AND u.tenant_id=ur.tenant_id
         WHERE r.tenant_id=$1 AND r.is_deleted=false AND u.username=$2
         ORDER BY r.created_at LIMIT 1`,
        [value.tenantA.tenantId, value.tenantASeed.administrator.username],
      )
    ).rows[0];

    const itemId = uuidV7();
    await value.adminPool.query(
      `INSERT INTO inventory_items (id, tenant_id, code, name, unit_of_measure, sales_eligible, status)
       VALUES ($1,$2,$3,'Canonical Workflow Item','EA',true,'ACTIVE')`,
      [itemId, value.tenantA.tenantId, 'WF-PUR-' + itemId.slice(0, 8)],
    );

    const definition = await value.app.inject({
      method: 'POST',
      url: '/api/v1/workflow/definitions',
      headers: auth,
      payload: {
        code: 'PURCHASE-REQ-APPROVAL',
        name: 'Purchase Requisition Approval',
        documentType: 'purchase_requisition',
        action: 'APPROVE',
        steps: [{ step: 1, roleId: role.id, requiredApprovals: 1 }],
      },
    });
    expect(definition.statusCode).toBe(201);
    const published = await value.app.inject({
      method: 'POST',
      url: '/api/v1/workflow/definitions/' + definition.json().definition.id + '/publish',
      headers: auth,
    });
    expect(published.statusCode).toBe(200);

    const created = await value.app.inject({
      method: 'POST',
      url: '/api/v1/purchase/requisitions',
      headers: auth,
      payload: {
        requiredDate: '2026-09-20',
        justification: 'Canonical workflow integration',
        lines: [{ itemId, description: 'Canonical Workflow Item', quantity: 2, unitPrice: 10, unitOfMeasure: 'EA' }],
      },
    });
    expect(created.statusCode).toBe(201);

    const requisition = created.json().requisition;
    const submitted = await value.app.inject({
      method: 'POST',
      url: '/api/v1/purchase/requisitions/' + requisition.id + '/submit',
      headers: auth,
      payload: { expectedVersion: requisition.version ?? 1 },
    });
    expect(submitted.statusCode).toBe(200);
    expect(submitted.json().requisition.status).toBe('SUBMITTED');
    expect(submitted.json().workflow.required).toBe(true);

    const legacyApprove = await value.app.inject({
      method: 'POST',
      url: '/api/v1/purchase/requisitions/' + requisition.id + '/approve',
      headers: auth,
      payload: { expectedVersion: submitted.json().requisition.version },
    });
    expect(legacyApprove.statusCode).toBe(404);

    const tasks = (await value.app.inject({
      method: 'GET',
      url: '/api/v1/workflow/tasks',
      headers: auth,
    })).json().tasks;
    expect(tasks).toHaveLength(1);

    const selfDecision = await value.app.inject({
      method: 'POST',
      url: '/api/v1/workflow/tasks/' + tasks[0].id + '/decision',
      headers: auth,
      payload: { decision: 'APPROVE' },
    });
    expect(selfDecision.statusCode).toBe(409);
  });
});
