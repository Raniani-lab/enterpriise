/** @odoo-module */
import { makeTestEnv } from "@web/../tests/helpers/mock_env";
import { getFixture, nextTick, mockTimeout, mount } from "@web/../tests/helpers/utils";
import { registry } from "@web/core/registry";
import { actionService } from "@web/webclient/actions/action_service";
import { viewService } from "@web/views/view_service";
import { ormService } from "@web/core/orm_service";


import { CrossTab } from '@bus/crosstab_bus';
import { makeFakeNotificationService } from "@web/../tests/helpers/mock_services";
import { useAutoSavingWarning } from "@documents_spreadsheet/bundle/actions/control_panel/collaborative_cross_tab_bus_warning";

const { Component, useState, xml } = owl;

let runPendingTimers;

class Parent extends Component {
    setup() {
        this.state = useState({
            isSaving: this.props.isSaving,
        });
        useAutoSavingWarning(() => this.state.isSaving);
    }

    update({ isSaving }) {
        this.state.isSaving = isSaving;
    }
}
Parent.components = {};
Parent.template = xml/*xml*/ `<div/>`;

async function createBusWarning(props, param = {}) {
    const env = await makeTestEnv();
    const target = getFixture();
    const warning = await mount(Parent, target, { env, props });
    return warning;
}

QUnit.module(
    "documents_spreadsheet > Collaborative bus warning",
    {
        beforeEach: function () {
            registry.category("services").add("action", actionService);
            registry.category("services").add("view", viewService);
            registry.category("services").add("orm", ormService);
            
            const { execRegisteredTimeouts } = mockTimeout();
            runPendingTimers = execRegisteredTimeouts;
        },
    },
    function () {
        QUnit.test("CrossTab bus exists", async function (assert) {
            // This test is meant to fail when the cross tab bus is removed (most likely
            // when the websocket bus is introduced).
            // If the cross tab bus is removed, the hook under test
            // here (useAutoSavingWarning) no longer serves any purpose and can be removed.
            assert.ok(CrossTab, "the cross tab bus still exists");
        });

        QUnit.test("warning is not displayed initially if not saving", async function (assert) {
            registry.category("services").add(
                "notification",
                makeFakeNotificationService(() => assert.step("notification"))
            );
            await createBusWarning({ isSaving: false });
            assert.verifySteps([]);
        });

        QUnit.test("warning is not displayed initially if saving", async function (assert) {
            registry.category("services").add(
                "notification",
                makeFakeNotificationService(() => assert.step("notification"))
            );
            await createBusWarning({ isSaving: true });
            assert.verifySteps([]);
        });

        QUnit.test("warning is displayed after a delay if saving", async function (assert) {
            registry.category("services").add(
                "notification",
                makeFakeNotificationService(() => assert.step("notification"))
            );
            await createBusWarning({ isSaving: true });
            assert.verifySteps([]);
            runPendingTimers();
            await nextTick();
            assert.verifySteps(["notification"]);
        });

        QUnit.test("warning appears after a delay if saving", async function (assert) {
            registry.category("services").add(
                "notification",
                makeFakeNotificationService(() => assert.step("notification"))
            );
            const warning = await createBusWarning({ isSaving: false });
            runPendingTimers();
            await nextTick();
            assert.verifySteps([]);
            warning.update({ isSaving: true });
            await nextTick();
            assert.verifySteps([]);
            runPendingTimers();
            await nextTick();
            assert.verifySteps(["notification"]);
        });

        QUnit.test("warning is removed directly if no longer saving", async function (assert) {
            registry.category("services").add(
                "notification",
                makeFakeNotificationService(() => {
                    assert.step("notification");
                    return () => assert.step("closed");
                })
            );
            const warning = await createBusWarning({ isSaving: true });
            runPendingTimers();
            await nextTick();
            assert.verifySteps(["notification"]);
            warning.update({ isSaving: false });
            await nextTick();
            assert.verifySteps(["closed"]);
        });
    }
);
