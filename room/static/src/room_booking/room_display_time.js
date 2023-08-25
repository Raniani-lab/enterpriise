/** @odoo-module **/

import { useInterval } from "@room/room_booking/useInterval";

import { Component, useState, xml } from "@odoo/owl";

export class RoomDisplayTime extends Component {
    static template = xml`<div class="fs-1 py-3" t-out="state.currentTime.toFormat('T DDDD')"/>`;

    setup() {
        this.state = useState({ currentTime: luxon.DateTime.now() });
        // Update the current time every second
        useInterval(() => (this.state.currentTime = luxon.DateTime.now()), 1000);
    }
}
