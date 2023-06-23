/* @odoo-module */

import { Component, xml } from "@odoo/owl";

import { DialingPanel } from "@voip/legacy/dialing_panel";

import { ComponentAdapter } from "@web/legacy/js/owl_compatibility";

export class DialingPanelAdapter extends ComponentAdapter {}

/**
 * Main component to wrap the DialingPanel. Ideally, it should conditionally
 * instantiate the DialingPanel (if it is open or not). However, the legacy
 * DialingPanel does rpcs at startup, so it hasn't been designed to be created
 * and destroyed dynamically. All this could be re-tought when it will be fully
 * converted in owl (e.g. rpcs done in the service at deployment).
 */
export class DialingPanelContainer extends Component {
    static components = { DialingPanelAdapter };
    static props = {};
    static template = xml`
        <div class="o_voip_dialing_panel_container">
            <DialingPanelAdapter Component="DialingPanel"/>
        </div>
    `;

    setup() {
        this.DialingPanel = DialingPanel;
    }
}
