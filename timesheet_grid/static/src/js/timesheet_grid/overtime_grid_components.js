/** @odoo-module alias=timesheet_grid.OvertimeGridComponents */

import { FloatTimeComponent, FloatToggleComponent } from 'web_grid.components';

class OvertimeGridTimeComponent extends FloatTimeComponent {
    /**
     * Formats the overtime value to either (+overtime) or (-overtime)
     * @private
     * @param {Number} value - the overtime value that is to be formatted
     * @returns {string} the final formatted string
     */
     _overtimeFormat(value) {
        const formatTimeString = this._format(value);
        if (value > 0) {
            return `\n(+${formatTimeString})`;
        } else if (value < 0) {
            return `\n(${formatTimeString})`;
        } else {
            return '';
        }
    }
}

OvertimeGridTimeComponent.defaultProps = Object.assign({}, FloatTimeComponent.defaultProps, {
    overtimeVal: 0,
    smallDisplay: false,
});

OvertimeGridTimeComponent.props = Object.assign({}, FloatTimeComponent.props, {
    overtimeVal: {
        type: Number,
        optional: true,
    },
    smallDisplay: {
        type: Boolean,
        optional: true,
    },
});

OvertimeGridTimeComponent.template = "timesheet_grid.OvertimeGridTimeComponent";

class OvertimeGridToggleComponent extends FloatToggleComponent {
    /**
     * Formats the overtime value to either (+overtime) or (-overtime)
     * @private
     * @param {Number} value - the overtime value that is to be formatted
     * @returns {string} the final formatted string
     */
     _overtimeFormat(value) {
        const formatTimeString = this._format(value);
        if (value > 0) {
            return `\n(+${formatTimeString})`;
        } else if (value < 0) {
            return `\n(${formatTimeString})`;
        } else {
            return '';
        }
    }
}

OvertimeGridToggleComponent.defaultProps = Object.assign({}, FloatToggleComponent.defaultProps, {
    overtimeVal: 0,
    smallDisplay: false,
});

OvertimeGridToggleComponent.props = Object.assign({}, FloatToggleComponent.props, {
    overtimeVal: {
        type: Number,
        optional: true,
    },
    smallDisplay: {
        type: Boolean,
        optional: true,
    },
});

OvertimeGridToggleComponent.template = "timesheet_grid.OvertimeGridToggleComponent";

export default { OvertimeGridTimeComponent, OvertimeGridToggleComponent }
