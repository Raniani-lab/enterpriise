/** @odoo-module **/

import { beforeEach, start } from '@mail/utils/test_utils';

QUnit.module('approvals', {}, function () {
QUnit.module('components', {}, function () {
QUnit.module('activity', {}, function () {
QUnit.module('activity_tests.js', {
    async beforeEach() {
        await beforeEach(this);

        this.start = async params => {
            const res = await start({ ...params, data: this.data });
            const { env, widget } = res;
            this.env = env;
            this.widget = widget;
            return res;
        };
    },
});

QUnit.test('activity with approval to be made by logged user', async function (assert) {
    assert.expect(14);

    this.data['approval.request'].records.push({
        activity_ids: [12],
        id: 100,
    });
    this.data['approval.approver'].records.push({
        request_id: 100,
        status: 'pending',
        user_id: this.data.currentUserId,
    });
    this.data['mail.activity'].records.push({
        can_write: true,
        id: 12,
        res_id: 100,
        res_model: 'approval.request',
        user_id: this.data.currentUserId,
    });
    const { createChatterContainerComponent } = await this.start();
    await createChatterContainerComponent({
        threadId: 100,
        threadModel: 'approval.request',
    });
    assert.containsOnce(
        document.body,
        '.o_Activity',
        "should have activity component"
    );
    assert.containsOnce(
        document.body,
        '.o_Activity_sidebar',
        "should have activity sidebar"
    );
    assert.containsOnce(
        document.body,
        '.o_Activity_core',
        "should have activity core"
    );
    assert.containsOnce(
        document.body,
        '.o_Activity_user',
        "should have activity user"
    );
    assert.containsOnce(
        document.body,
        '.o_Activity_info',
        "should have activity info"
    );
    assert.containsNone(
        document.body,
        '.o_Activity_note',
        "should not have activity note"
    );
    assert.containsNone(
        document.body,
        '.o_Activity_details',
        "should not have activity details"
    );
    assert.containsNone(
        document.body,
        '.o_Activity_mailTemplates',
        "should not have activity mail templates"
    );
    assert.containsNone(
        document.body,
        '.o_Activity_editButton',
        "should not have activity Edit button"
    );
    assert.containsNone(
        document.body,
        '.o_Activity_cancelButton',
        "should not have activity Cancel button"
    );
    assert.containsNone(
        document.body,
        '.o_Activity_markDoneButton',
        "should not have activity Mark as Done button"
    );
    assert.containsNone(
        document.body,
        '.o_Activity_uploadButton',
        "should not have activity Upload button"
    );
    assert.containsOnce(
        document.body,
        '.o_Approval_approveButton',
        "should have approval approve button"
    );
    assert.containsOnce(
        document.body,
        '.o_Approval_refuseButton',
        "should have approval refuse button"
    );
});

QUnit.test('activity with approval to be made by another user', async function (assert) {
    assert.expect(16);

    this.data['approval.request'].records.push({
        activity_ids: [12],
        id: 100,
    });
    this.data['res.users'].records.push({ id: 11 });
    this.data['approval.approver'].records.push({
        request_id: 100,
        status: 'pending',
        user_id: 11,
    });
    this.data['mail.activity'].records.push({
        can_write: true,
        id: 12,
        res_id: 100,
        res_model: 'approval.request',
        user_id: 11,
    });
    const { createChatterContainerComponent } = await this.start();
    await createChatterContainerComponent({
        threadId: 100,
        threadModel: 'approval.request',
    });
    assert.containsOnce(
        document.body,
        '.o_Activity',
        "should have activity component"
    );
    assert.containsOnce(
        document.body,
        '.o_Activity_sidebar',
        "should have activity sidebar"
    );
    assert.containsOnce(
        document.body,
        '.o_Activity_core',
        "should have activity core"
    );
    assert.containsOnce(
        document.body,
        '.o_Activity_user',
        "should have activity user"
    );
    assert.containsOnce(
        document.body,
        '.o_Activity_info',
        "should have activity info"
    );
    assert.containsNone(
        document.body,
        '.o_Activity_note',
        "should not have activity note"
    );
    assert.containsNone(
        document.body,
        '.o_Activity_details',
        "should not have activity details"
    );
    assert.containsNone(
        document.body,
        '.o_Activity_mailTemplates',
        "should not have activity mail templates"
    );
    assert.containsNone(
        document.body,
        '.o_Activity_editButton',
        "should not have activity Edit button"
    );
    assert.containsNone(
        document.body,
        '.o_Activity_cancelButton',
        "should not have activity Cancel button"
    );
    assert.containsNone(
        document.body,
        '.o_Activity_markDoneButton',
        "should not have activity Mark as Done button"
    );
    assert.containsNone(
        document.body,
        '.o_Activity_uploadButton',
        "should not have activity Upload button"
    );
    assert.containsNone(
        document.body,
        '.o_Approval_approveButton',
        "should not have approval approve button"
    );
    assert.containsNone(
        document.body,
        '.o_Approval_refuseButton',
        "should not have approval refuse button"
    );
    assert.containsOnce(
        document.body,
        '.o_Approval_toApproveText',
        "should contain 'To approve' text container"
    );
    assert.strictEqual(
        document.querySelector('.o_Approval_toApproveText').textContent.trim(),
        "To Approve",
        "should contain 'To approve' text"
    );
});

QUnit.test('approve approval', async function (assert) {
    assert.expect(7);

    this.data['approval.request'].records.push({
        activity_ids: [12],
        id: 100,
    });
    this.data['approval.approver'].records.push({
        id: 12,
        request_id: 100,
        status: 'pending',
        user_id: this.data.currentUserId,
    });
    this.data['mail.activity'].records.push({
        can_write: true,
        id: 12,
        res_id: 100,
        res_model: 'approval.request',
        user_id: this.data.currentUserId,
    });
    const { createChatterContainerComponent } = await this.start({
        async mockRPC(route, args) {
            if (args.method === 'action_approve') {
                assert.strictEqual(args.args.length, 1);
                assert.strictEqual(args.args[0].length, 1);
                assert.strictEqual(args.args[0][0], 12);
                assert.step('action_approve');
            }
            return this._super(...arguments);
        },
    });
    await createChatterContainerComponent({
        threadId: 100,
        threadModel: 'approval.request',
    });
    assert.containsOnce(
        document.body,
        '.o_Activity',
        "should have activity component"
    );
    assert.containsOnce(
        document.body,
        '.o_Approval_approveButton',
        "should have approval approve button"
    );

    document.querySelector('.o_Approval_approveButton').click();
    assert.verifySteps(['action_approve'], "Approve button should trigger the right rpc call");
});

QUnit.test('refuse approval', async function (assert) {
    assert.expect(7);

    this.data['approval.request'].records.push({
        activity_ids: [12],
        id: 100,
    });
    this.data['approval.approver'].records.push({
        id: 12,
        request_id: 100,
        status: 'pending',
        user_id: this.data.currentUserId,
    });
    this.data['mail.activity'].records.push({
        can_write: true,
        id: 12,
        res_id: 100,
        res_model: 'approval.request',
        user_id: this.data.currentUserId,
    });
    const { createChatterContainerComponent } = await this.start({
        async mockRPC(route, args) {
            if (args.method === 'action_refuse') {
                assert.strictEqual(args.args.length, 1);
                assert.strictEqual(args.args[0].length, 1);
                assert.strictEqual(args.args[0][0], 12);
                assert.step('action_refuse');
            }
            return this._super(...arguments);
        },
    });
    await createChatterContainerComponent({
        threadId: 100,
        threadModel: 'approval.request',
    });
    assert.containsOnce(
        document.body,
        '.o_Activity',
        "should have activity component"
    );
    assert.containsOnce(
        document.body,
        '.o_Approval_refuseButton',
        "should have approval refuse button"
    );

    document.querySelector('.o_Approval_refuseButton').click();
    assert.verifySteps(['action_refuse'], "Refuse button should trigger the right rpc call");
});

});
});
});
