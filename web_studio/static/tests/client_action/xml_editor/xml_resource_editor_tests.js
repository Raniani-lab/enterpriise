/** @odoo-module **/

import { ResizablePanel } from "@web_studio/client_action/xml_resource_editor/resizable_panel/resizable_panel";
import { Component, reactive, xml } from "@odoo/owl";
import { browser } from "@web/core/browser/browser";
import { makeTestEnv } from "@web/../tests/helpers/mock_env";
import {
    getFixture,
    patchWithCleanup,
    mount,
    nextTick,
    triggerEvents,
} from "@web/../tests/helpers/utils";
import { XmlResourceEditor } from "@web_studio/client_action/xml_resource_editor/xml_resource_editor";
import { hotkeyService } from "@web/core/hotkeys/hotkey_service";
import { uiService } from "@web/core/ui/ui_service";
import { registry } from "@web/core/registry";

QUnit.module("Resizable Panel", (hooks) => {
    let env;
    let target;

    hooks.beforeEach(async () => {
        env = await makeTestEnv();
        target = getFixture();
        patchWithCleanup(browser, {
            setTimeout: (fn) => Promise.resolve().then(fn),
        });
    });

    QUnit.test("Width cannot exceed viewport width", async (assert) => {
        class Parent extends Component {
            static components = { ResizablePanel };
            static template = xml`
                <ResizablePanel>
                    <p>A</p>
                    <p>Cool</p>
                    <p>Paragraph</p>
                </ResizablePanel>
            `;
        }

        await mount(Parent, target, { env });
        assert.containsOnce(target, ".o_resizable_panel");
        assert.containsOnce(target, ".o_resizable_panel_handle");

        const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
        const sidepanel = target.querySelector(".o_resizable_panel");
        sidepanel.style.width = `${vw + 100}px`;

        const sidepanelWidth = sidepanel.getBoundingClientRect().width;
        assert.ok(
            sidepanelWidth <= vw && sidepanelWidth > vw * 0.95,
            "The sidepanel should be smaller or equal to the view width"
        );
    });

    QUnit.test("minWidth props can be updated", async (assert) => {
        class Parent extends Component {
            static components = { ResizablePanel };
            static template = xml`
                <div class="d-flex">
                    <ResizablePanel minWidth="props.state.minWidth">
                        <div style="width: 10px;" class="text-break">
                            A cool paragraph
                        </div>
                    </ResizablePanel>
                </div>
            `;
        }
        const state = reactive({ minWidth: 20 });
        await mount(Parent, target, { env, props: { state } });
        const resizablePanelEl = target.querySelector(".o_resizable_panel");
        const handle = resizablePanelEl.querySelector(".o_resizable_panel_handle");
        await triggerEvents(handle, null, ["mousedown", ["mousemove", { clientX: 15 }], "mouseup"]);

        assert.strictEqual(resizablePanelEl.getBoundingClientRect().width, 20);
        state.minWidth = 40;
        await nextTick();
        await triggerEvents(handle, null, ["mousedown", ["mousemove", { clientX: 15 }], "mouseup"]);
        assert.strictEqual(resizablePanelEl.getBoundingClientRect().width, 40);
    });
});

QUnit.module("XmlResourceEditor", (hooks) => {
    let target;

    hooks.beforeEach(() => {
        registry.category("services").add("ui", uiService).add("hotkey", hotkeyService);
        target = getFixture();
    });

    QUnit.test("can display warnings", async (assert) => {
        const mockRPC = (route, args) => {
            if (route === "/web_studio/get_xml_editor_resources") {
                return {
                    views: [
                        {
                            id: 1,
                            arch: "<data />",
                        },
                    ],
                };
            }
        };

        class Parent extends Component {
            static components = { XmlResourceEditor };
            static template = xml`<XmlResourceEditor displayAlerts="props.state.displayAlerts" onClose="() => {}" mainResourceId="1" />`;
        }

        const env = await makeTestEnv({ mockRPC });
        const state = reactive({ displayAlerts: true });
        await mount(Parent, target, { env, props: { state } });
        assert.containsOnce(target, ".o_web_studio_code_editor_info .alert.alert-warning");
        state.displayAlerts = false;
        await nextTick();
        assert.containsNone(target, ".o_web_studio_code_editor_info .alert.alert-warning");
    });
});
