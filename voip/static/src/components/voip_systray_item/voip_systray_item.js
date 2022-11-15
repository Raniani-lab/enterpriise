/* @odoo-module */

import { Component } from "@odoo/owl";

export class VoipSystrayItem extends Component {
    static props = {};
    static template = "voip.SystrayItem";

    /**
     * @param {MouseEvent} ev
     */
    onClick(ev) {
        this.env.services.voip.bus.trigger("toggle-softphone-display");
    }
}
