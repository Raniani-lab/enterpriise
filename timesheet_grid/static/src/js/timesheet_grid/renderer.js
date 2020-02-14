odoo.define('timesheet_grid.GridRenderer', function (require) {
    "use strict";

    const GridRenderer = require('web_grid.GridRenderer');
    const TimerComponent = require('timesheet_grid.TimerComponent');

    class TimesheetGridRenderer extends GridRenderer {
        constructor(parent, props) {
            super(parent, props);
            this.initialGridAnchor = props.context.grid_anchor;
            this.initialGroupBy = props.groupBy;
        }

        //----------------------------------------------------------------------
        // Getters
        //----------------------------------------------------------------------

        /**
         * @returns {boolean} returns true if when we need to display the timer button
         *
         */
        get showTimer() {
            return ((this.formatType === "float_time") && ((
                this.props.context.grid_anchor === this.initialGridAnchor &&
                !this.initialGroupBy.some(x => !this.props.groupBy.includes(x))
            ) && (Object.prototype.hasOwnProperty.call(this.props.data, this.grid_index))));
        }
    }
    TimesheetGridRenderer.props = Object.assign({}, GridRenderer.props, {
        serverTime: {
            type: String,
            optional: true
        },
    });
    TimesheetGridRenderer.components = { TimerComponent };

    return TimesheetGridRenderer;
});
