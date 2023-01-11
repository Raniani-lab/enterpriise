/** @odoo-module **/

import { GanttModel } from "@web_gantt/gantt_model";

export class MRPWorkorderGanttModel extends GanttModel {
    /**
     * @override
     */
    _addProgressBarInfo(_, rows) {
        super._addProgressBarInfo(...arguments);
        for (const row of rows) {
            if (row.progressBar) {
                if (row.progressBar.value_formatted) {
                    row.progressBar.value_formatted += this.env._t(" h");
                }
                if (row.progressBar.max_value_formatted) {
                    row.progressBar.max_value_formatted += this.env._t(" h");
                }
            }
        }
    }
}
