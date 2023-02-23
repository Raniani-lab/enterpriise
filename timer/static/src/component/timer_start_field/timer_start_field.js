/** @odoo-module */

import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { standardFieldProps } from "@web/views/fields/standard_field_props";

const { Component, useState, onWillStart, onWillUpdateProps } = owl;

export class TimerStartField extends Component {
    setup() {
        super.setup(...arguments);
        this.timerService = useService("timer");
        this.state = useState({ timer: undefined, time: "", timerPause: this.timerPause, serverOffset: 0 });

        onWillStart(this.onWillStart);
        onWillUpdateProps(this.onWillUpdateProps);
    }

    async onWillStart() {
        const serverTime = await this.timerService.getServerTime();
        this.timerService.computeOffset(serverTime);
        this.state.serverOffset = this.timerService.offset;
        this.startTimer(this.props.record.data[this.props.name]);
    }

    onWillUpdateProps(nextProps) {
        clearInterval(this.state.timer);
        this.state.timer = undefined;
        this.state.timerPause = nextProps.record && nextProps.record.data.timer_pause;
        if (this.timerPause && !this.state.timerPause) {
            this.timerService.clearTimer();
        }
        this.startTimer(nextProps.record.data[nextProps.name]);
    }

    startTimer(timerStart) {
        if (timerStart) {
            let currentTime;
            if (this.timerPause) {
                currentTime = this.timerPause;
                this.timerService.computeOffset(currentTime);
            } else {
                this.timerService.offset = this.state.serverOffset;
                currentTime = this.timerService.getCurrentTime();
            }
            this.timerService.setTimer(0, timerStart, currentTime);
            this.state.time = this.timerService.timerFormatted;
            this.state.timer = setInterval(() => {
                if (this.timerPause) {
                    clearInterval(this.state.timer);
                } else {
                    this.timerService.updateTimer(timerStart);
                    this.state.time = this.timerService.timerFormatted;
                }
            }, 1000);
        } else if (!this.timerPause) {
            clearInterval(this.state.timer);
            this.state.time = "";
            this.timerService.clearTimer();
        }
    }

    get timerPause() {
        return this.props.record.data.timer_pause;
    }
}

TimerStartField.props = {
    ...standardFieldProps,
};
TimerStartField.template = "timer.TimerStartField";

export const timerStartField = {
    component: TimerStartField,
    fieldDependencies: [ { name: "timer_pause", type: "datetime" } ],
};

registry.category("fields").add("timer_start_field", timerStartField);
