/** @odoo-module **/

import { click, start, startServer } from "@mail/../tests/helpers/test_utils";

import { makeDeferred } from "@web/../tests/helpers/utils";

QUnit.module("activity (patch)");

QUnit.test("activity with approval to be made by logged user", async (assert) => {
    const pyEnv = await startServer();
    const requestId = pyEnv["approval.request"].create({});
    pyEnv["approval.approver"].create({
        request_id: requestId,
        status: "pending",
        user_id: pyEnv.currentUserId,
    });
    pyEnv["mail.activity"].create({
        can_write: true,
        res_id: requestId,
        res_model: "approval.request",
        user_id: pyEnv.currentUserId,
    });
    const { openView } = await start();
    await openView({
        res_model: "approval.request",
        res_id: requestId,
        views: [[false, "form"]],
    });
    assert.containsOnce($, ".o-mail-Activity");
    assert.containsOnce($, ".o-mail-Activity-sidebar");
    assert.containsOnce($, ".o-mail-Activity-user");
    assert.containsOnce($, ".o-mail-Activity-info");
    assert.containsNone($, ".o-mail-Activity-note", "should not have activity note");
    assert.containsNone($, ".o-mail-Activity-details");
    assert.containsNone($, ".o-mail-Activity-mailTemplates");
    assert.containsNone($, ".btn:contains('Edit')");
    assert.containsNone($, ".o-mail-Activity span:contains(Cancel)");
    assert.containsNone($, ".btn:contains('Mark Done')");
    assert.containsNone($, ".o-mail-Activity-info:contains('Upload Document')");
    assert.containsOnce($, ".o-mail-Activity button:contains('Approve')");
    assert.containsOnce($, ".o-mail-Activity button:contains('Refuse')");
});

QUnit.test("activity with approval to be made by another user", async (assert) => {
    const pyEnv = await startServer();
    const requestId = pyEnv["approval.request"].create({});
    const userId = pyEnv["res.users"].create({});
    pyEnv["approval.approver"].create({
        request_id: requestId,
        status: "pending",
        user_id: userId,
    });
    pyEnv["mail.activity"].create({
        can_write: true,
        res_id: requestId,
        res_model: "approval.request",
        user_id: userId,
    });
    const { openView } = await start();
    await openView({
        res_model: "approval.request",
        res_id: requestId,
        views: [[false, "form"]],
    });
    assert.containsOnce($, ".o-mail-Activity");
    assert.containsOnce($, ".o-mail-Activity-sidebar");
    assert.containsOnce($, ".o-mail-Activity-user");
    assert.containsOnce($, ".o-mail-Activity-info");
    assert.containsNone($, ".o-mail-Activity-note");
    assert.containsNone($, ".o-mail-Activity-details");
    assert.containsNone($, ".o-mail-Activity-mailTemplates");
    assert.containsNone($, ".btn:contains('Edit')");
    assert.containsNone($, ".o-mail-Activity span:contains(Cancel)");
    assert.containsNone($, ".btn:contains('Mark Done')");
    assert.containsNone($, ".o-mail-Activity-info:contains('Upload Document')");
    assert.containsNone($, ".o-mail-Activity button:contains('Approve')");
    assert.containsNone($, ".o-mail-Activity button:contains('Refuse')");
    assert.containsOnce($, ".o-mail-Activity span:contains('To Approve')");
});

QUnit.test("approve approval", async (assert) => {
    const pyEnv = await startServer();
    const requestId = pyEnv["approval.request"].create({});
    pyEnv["approval.approver"].create({
        request_id: requestId,
        status: "pending",
        user_id: pyEnv.currentUserId,
    });
    pyEnv["mail.activity"].create({
        can_write: true,
        res_id: requestId,
        res_model: "approval.request",
        user_id: pyEnv.currentUserId,
    });
    const def = makeDeferred();
    const { openView } = await start({
        async mockRPC(route, args) {
            if (args.method === "action_approve") {
                assert.strictEqual(args.args.length, 1);
                assert.strictEqual(args.args[0], requestId);
                assert.step("action_approve");
                def.resolve();
            }
        },
    });
    await openView({
        res_model: "approval.request",
        res_id: requestId,
        views: [[false, "form"]],
    });
    assert.containsOnce($, ".o-mail-Activity");
    assert.containsOnce($, ".o-mail-Activity button:contains('Approve')");

    await click(".o-mail-Activity button:contains('Approve')");
    await def;
    assert.verifySteps(["action_approve"]);
});

QUnit.test("refuse approval", async (assert) => {
    const pyEnv = await startServer();
    const requestId = pyEnv["approval.request"].create({});
    pyEnv["approval.approver"].create({
        request_id: requestId,
        status: "pending",
        user_id: pyEnv.currentUserId,
    });
    pyEnv["mail.activity"].create({
        can_write: true,
        res_id: requestId,
        res_model: "approval.request",
        user_id: pyEnv.currentUserId,
    });
    const def = makeDeferred();
    const { openView } = await start({
        async mockRPC(route, args) {
            if (args.method === "action_refuse") {
                assert.strictEqual(args.args.length, 1);
                assert.strictEqual(args.args[0], requestId);
                assert.step("action_refuse");
                def.resolve();
            }
        },
    });
    await openView({
        res_model: "approval.request",
        res_id: requestId,
        views: [[false, "form"]],
    });
    assert.containsOnce($, ".o-mail-Activity");
    assert.containsOnce($, ".o-mail-Activity button:contains('Refuse')");

    await click(".o-mail-Activity button:contains('Refuse')");
    await def;
    assert.verifySteps(["action_refuse"]);
});
