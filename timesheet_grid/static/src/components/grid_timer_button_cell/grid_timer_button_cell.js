/** @odoo-module */

import { Component } from "@odoo/owl";

export class GridTimerButtonCell extends Component {
    get timerRunning() {
        return this.props.timerRunning || this.props.row.timerRunning;
    }

    get letter() {
        if (!this.props.hovered && this.props.index < 26) {
            const from = this.props.addTimeMode ? 65 : 97;
            return String.fromCharCode(from + this.props.index);
        } else {
            return '';
        }
    }

    get classNames() {
        const classNames = [];
        let backgroundColor = 'bg-white-75';
        if (!this.env.isSmall) {
            if (this.timerRunning && this.props.hovered) {
                backgroundColor = 'bg-danger';
            } else if (this.timerRunning) {
                backgroundColor = 'bg-primary';
            }
        } else {
            backgroundColor = 'bg-primary';
        }
        if (this.props.hovered && !this.env.isSmall) {
            if (this.timerRunning) {
                backgroundColor = 'bg-danger';
            } else {
                backgroundColor = 'bg-primary';
            }
        }
        classNames.push(backgroundColor);
        return classNames.join(' ');
    }

    get iconClass() {
        const classNames = ['text-white fa'];
        if (this.timerRunning) {
            classNames.push('fa-play');
        } else if (this.props.index >= 26 || this.env.isSmall) {
            if (this.props.addTimeMode) {
                classNames.push('fa-plus');
            } else {
                classNames.push('fa-play');
            }
        }
        if (this.props.hovered && !this.env.isSmall) {
            if (this.timerRunning) {
                classNames.push('fa-stop');
            } else {
                classNames.push('fa-play');
            }
        }
        return classNames.join(' ');
    }
}

GridTimerButtonCell.template = 'timesheet_grid.GridTimerButtonCell';
GridTimerButtonCell.props = {
    index: Number,
    row: Object,
    addTimeMode: Boolean,
    hovered: { type: Boolean, optional: true },
    timerRunning: { type: Boolean, optional: true },
    onTimerClick: Function,
};
