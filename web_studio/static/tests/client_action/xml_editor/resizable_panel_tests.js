/** @odoo-module **/

import { ResizablePanel } from "@web_studio/client_action/xml_resource_editor/resizable_panel/resizable_panel";
import { Component, xml } from "@odoo/owl";
import { browser } from "@web/core/browser/browser";
import { makeTestEnv } from "@web/../tests/helpers/mock_env";
import { getFixture, patchWithCleanup, mount } from "@web/../tests/helpers/utils";

QUnit.module("XmlEditor", (hooks) => {
    QUnit.module("Resizable Panel");

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
});
