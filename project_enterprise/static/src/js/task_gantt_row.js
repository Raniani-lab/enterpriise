/** @odoo-module **/

import fieldUtils from 'web.field_utils';
import GanttRow from 'web_gantt.GanttRow';
import { getDateFormatForScale } from "./task_gantt_utils";

const TaskGanttRow = GanttRow.extend({
    template: 'TaskGanttMilestonesView.Row',

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @override
    */
    _prepareSlots: function () {
        this._super(...arguments);
        let dateFormat = getDateFormatForScale(this.SCALES[this.state.scale]);
        this.slots.forEach((slot) => {
            const slotKey = slot.start.format(dateFormat);
            slot.milestonesInfo = this.viewInfo.slotsMilestonesDict[slotKey];
        });
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
        return data;
    },
});

export default TaskGanttRow;
