/** @odoo-module alias=mrp.MRPWorkorderGanttRow **/

import GanttRow from 'web_gantt.GanttRow';
import fieldUtils from 'web.field_utils';

const MRPWorkorderGanttRow = GanttRow.extend({
    template: 'GanttView.Row',

    // @override
    _allowToSpan() {
        return false;
    },

    // @override
    _getAggregateGroupedPillsDisplayName(pill) {
        if(this.rowId != "__total_row__") {
            return null;
        }
        let duration = 0;
        for(const aggregatedPill of _.uniq(pill.aggregatedPills)) {
            const workorder_start = moment.max(pill.startDate, aggregatedPill.date_planned_start);
            const workorder_stop = moment.max(workorder_start, moment.min(pill.stopDate, aggregatedPill.date_planned_finished));
            let pill_duration = workorder_stop.diff(workorder_start, "minutes");
            for(const k in this.getParent().rowWidgets) {
                const row = this.getParent().rowWidgets[k];
                for(const rowPill of row.pills) {
                    if(rowPill.id == aggregatedPill.id) {
                        for(const unavailability of row.unavailabilities) {
                            const unavailability_start = moment.max(workorder_start, unavailability.startDate);
                            const unavailability_stop = moment.max(unavailability_start, moment.min(workorder_stop, unavailability.stopDate.add(1,"seconds")));
                            const unavailability_duration = unavailability_stop.diff(unavailability_start, "minutes");
                            pill_duration -= unavailability_duration;
                        }
                    }
                }
            }
            duration += pill_duration;
        }
        duration /= 60;
        return fieldUtils.format.float_time(duration);
    }
});

export default MRPWorkorderGanttRow;
