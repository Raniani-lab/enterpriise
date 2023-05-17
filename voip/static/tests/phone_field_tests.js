/* @odoo-module */

import { addFakeModel } from "@bus/../tests/helpers/model_definitions_helpers";

import { click, start, startServer } from "@mail/../tests/helpers/test_utils";

import { nextTick } from "@web/../tests/helpers/utils";

function makeFakeVoipService(onCall = () => {}) {
    return {
        start() {
            return {
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
            }),
        },
    });
    await openFormView("fake", fakeId, {
        waitUntilDataLoaded: false,
        waitUntilMessagesLoaded: false,
    });
    click(".o_field_phone a");
    assert.verifySteps(["call placed"]);
});

QUnit.test(
    "Click on PhoneField link in readonly form view does not switch the form view to edit mode",
    async (assert) => {
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
        click(".o_field_phone a");
        await nextTick();
        assert.containsOnce($, ".o_form_readonly");
    }
);