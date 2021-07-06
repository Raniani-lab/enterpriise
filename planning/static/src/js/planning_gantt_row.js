/** @odoo-module alias=planning.PlanningGanttRow **/

import HrGanttRow from 'hr_gantt.GanttRow';
import fieldUtils from 'web.field_utils';

const PlanningGanttRow = HrGanttRow.extend({
    template: 'PlanningGanttView.Row',

    init(parent, pillsInfo, viewInfo, options) {
        this._super(...arguments);
        const isGroupedByResource = pillsInfo.groupedByField === 'resource_id';
        const isEmptyGroup = pillsInfo.groupId === 'empty';
        this.employeeID = pillsInfo.pills && pillsInfo.pills.length && Array.isArray(pillsInfo.pills[0].employee_id) ? pillsInfo.pills[0].employee_id[0] : false;
        this.showEmployeeAvatar = (isGroupedByResource && !isEmptyGroup && !!this.employeeID);
    },

    _getEmployeeID() {
        return this.employeeID;
    },

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
