/* @odoo-module */

import { addFakeModel } from "@bus/../tests/helpers/model_definitions_helpers";

import { click, contains, start, startServer } from "@mail/../tests/helpers/test_utils";

import { EventBus } from "@odoo/owl";

import { makeDeferred, nextTick } from "@web/../tests/helpers/utils";

function makeFakeVoipService(onCall = () => {}) {
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

const views = {
    "fake,false,form": `
        <form string="Fake" edit="0">
            <sheet>
                <group>
                    <field name="phone_number" widget="phone"/>
                </group>
            </sheet>
        </form>`,
};

addFakeModel("fake", { phone_number: { string: "Phone Number", type: "char" } });

QUnit.module("phone field");

QUnit.test("Click on PhoneField link triggers a call", async (assert) => {
    const pyEnv = await startServer();
    const fakeId = pyEnv["fake"].create({ phone_number: "+36 55 369 678" });
    const def = makeDeferred();
    const { openFormView } = await start({
        serverData: { views },
        services: {
            voip: makeFakeVoipService((params) => {
                assert.step("call placed");
                assert.deepEqual(params, {
                    number: "+36 55 369 678",
                    resId: fakeId,
                    resModel: "fake",
                });
                def.resolve();
            }),
        },
    });
    await openFormView("fake", fakeId, {
        waitUntilDataLoaded: false,
        waitUntilMessagesLoaded: false,
    });
    await click(".o_field_phone a:eq(0)");
    await def;
    assert.verifySteps(["call placed"]);
});

QUnit.test(
    "Click on PhoneField link in readonly form view does not switch the form view to edit mode",
    async () => {
        const pyEnv = await startServer();
        const fakeId = pyEnv["fake"].create({ phone_number: "+689 312172" });
        const { openFormView } = await start({
            serverData: { views },
            services: { voip: makeFakeVoipService() },
        });
        await openFormView("fake", fakeId, {
            waitUntilDataLoaded: false,
            waitUntilMessagesLoaded: false,
        });
        await click(".o_field_phone a:eq(0)");
        await nextTick();
        await contains(".o_form_readonly");
    }
);
