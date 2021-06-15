/** @odoo-module alias=planning.PlanningGanttRow **/

import HrGanttRow from 'hr_gantt.GanttRow';
import fieldUtils from 'web.field_utils';

const PlanningGanttRow = HrGanttRow.extend({
    template: 'PlanningGanttView.Row',
    /**
     * Add allocated hours formatted to context
     *
     * @private
     * @override
     */
    _getPopoverContext: function () {
        const data = this._super.apply(this, arguments);
        data.allocatedHoursFormatted = fieldUtils.format.float_time(data.allocated_hours);
        data.allocatedPercentageFormatted = fieldUtils.format.float(data.allocated_percentage);
        return data;
    },
});

export default PlanningGanttRow;
