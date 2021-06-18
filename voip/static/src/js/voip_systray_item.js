/** @odoo-module **/

import { useService } from "@web/core/service_hook";

const { Component } = owl;

/**
 * Systray item allowing to toggle the voip DialingPanel.
 */
export class VoipSystrayItem extends Component {
    setup() {
        this.voip = useService('voip');
    }
    /**
     * Toggle the dialing panel.
     */
    onClick() {
        this.voip.bus.trigger('TOGGLE_DIALING_PANEL');
    }
}
VoipSystrayItem.template = "voip.SystrayItem";
