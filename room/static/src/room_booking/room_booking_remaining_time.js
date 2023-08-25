/** @odoo-module **/

import { useInterval } from "@room/room_booking/useInterval";

import { Component, useState, xml } from "@odoo/owl";

export class RoomBookingRemainingTime extends Component {
    static template = xml`
        <div class="o_room_remaining_time my-5 border border-2 rounded-circle py-4 text-center bg-dark"
             t-out="state.remainingTime.toFormat('hh:mm:ss')"/>
    `;
    static props = {
        endTime: { type: Object },
    };

    setup() {
        this.state = useState({ remainingTime: this.props.endTime.diffNow() });
        // Update the remaining time every second
        useInterval(() => (this.state.remainingTime = this.props.endTime.diffNow()), 1000);
    }
}
