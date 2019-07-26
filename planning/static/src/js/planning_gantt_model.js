odoo.define('planning.PlanningGanttModel', function (require) {
    "use strict";

    var GanttModel = require('web_gantt.GanttModel');

    var PlanningGanttModel = GanttModel.extend({
        /**
         * @private
         * @override
         * @returns {Object[]}
         */
        _generateRows: function (params) {
            var rows = this._super(params);
            // is the data grouped by?
            if(params.groupedBy && params.groupedBy.length){
                // in the last row is the grouped by field is null
                if(rows && rows.length && rows[rows.length - 1] && !rows[rows.length - 1].resId){
                    // then make it the first one
                    rows.unshift(rows.pop());
                }
            }
            return rows;
        },
    });

    return PlanningGanttModel;
});
