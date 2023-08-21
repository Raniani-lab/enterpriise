/* @odoo-module */

import { click, start, startServer } from "@mail/../tests/helpers/test_utils";

import { EventBus } from "@odoo/owl";

import { makeDeferred } from "@web/../tests/helpers/utils";

function makeFakeVoipService(onCall) {
    return {
        start() {
            return {
                bus: new EventBus(),
                get canCall() {
                    return true;
                },
                call(params) {
                    onCall(params);
                },
            };
        },
    };
}

QUnit.module("activity");

QUnit.test("Landline number is displayed in activity info.", async (assert) => {
    const pyEnv = await startServer();
    const partnerId = pyEnv["res.partner"].create({});
    pyEnv["mail.activity"].create({
        phone: "+1-202-555-0182",
        res_id: partnerId,
        res_model: "res.partner",
    });
    const { openFormView } = await start();
    await openFormView("res.partner", partnerId);
    assert.strictEqual($(".o-mail-Activity-voip-landline-number").text().trim(), "+1-202-555-0182");
});

QUnit.test("Mobile number is displayed in activity info.", async (assert) => {
    const pyEnv = await startServer();
    const partnerId = pyEnv["res.partner"].create({});
    pyEnv["mail.activity"].create({
        mobile: "4567829775",
        res_id: partnerId,
        res_model: "res.partner",
    });
    const { openFormView } = await start();
    await openFormView("res.partner", partnerId);
    assert.strictEqual($(".o-mail-Activity-voip-mobile-number").text().trim(), "4567829775");
});

QUnit.test(
    "When both landline and mobile numbers are provided, a prefix is added to distinguish the two in activity info.",
    async (assert) => {
        const pyEnv = await startServer();
        const partnerId = pyEnv["res.partner"].create({});
        pyEnv["mail.activity"].create({
            phone: "+1-202-555-0182",
            mobile: "4567829775",
            res_id: partnerId,
            res_model: "res.partner",
        });
        const { openFormView } = await start();
        await openFormView("res.partner", partnerId);
        assert.strictEqual(
            $(".o-mail-Activity-voip-mobile-number").text().trim(),
            "Mobile: 4567829775"
        );
        assert.strictEqual(
            $(".o-mail-Activity-voip-landline-number").text().trim(),
            "Phone: +1-202-555-0182"
        );
    }
);

QUnit.test("Click on landline number from activity info triggers a call.", async (assert) => {
    const pyEnv = await startServer();
    const partnerId = pyEnv["res.partner"].create({});
    const activityId = pyEnv["mail.activity"].create({
        phone: "+1-202-555-0182",
        res_id: partnerId,
        res_model: "res.partner",
    });
    const def = makeDeferred();
    const { openFormView } = await start({
        services: {
            voip: makeFakeVoipService((params) => {
                assert.step("call to landline number triggered");
                assert.deepEqual(params, {
                    activityId,
                    number: "+1-202-555-0182",
                    fromActivity: true,
                });
                def.resolve();
            }),
        },
    });
    await openFormView("res.partner", partnerId);
    await click(".o-mail-Activity-voip-landline-number > a");
    await def;
    assert.verifySteps(["call to landline number triggered"]);
});

QUnit.test("Click on mobile number from activity info triggers a call.", async (assert) => {
    const pyEnv = await startServer();
    const partnerId = pyEnv["res.partner"].create({});
    const activityId = pyEnv["mail.activity"].create({
        mobile: "4567829775",
        res_id: partnerId,
        res_model: "res.partner",
    });
    const def = makeDeferred();
    const { openFormView } = await start({
        services: {
            voip: makeFakeVoipService((params) => {
                assert.step("call to mobile number triggered");
                assert.deepEqual(params, {
                    activityId,
                    number: "4567829775",
                    fromActivity: true,
                });
                def.resolve();
            }),
        },
    });
    await openFormView("res.partner", partnerId);
    click(".o-mail-Activity-voip-mobile-number > a");
    await def;
    assert.verifySteps(["call to mobile number triggered"]);
});
