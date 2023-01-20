/* @odoo-module */

import { GanttController } from "@web_gantt/gantt_controller";
import { useWorkEntry } from "@hr_work_entry_contract/views/work_entry_hook";

export class WorkEntriesGanttController extends GanttController {
    setup() {
        super.setup(...arguments);
        const { onRegenerateWorkEntries } = useWorkEntry({
            getEmployeeIds: () => {
                const { rows } = this.model.data;
                if (rows.length === 1) {
                    const { groupedByField, resId } = rows[0];
                    if (groupedByField === "employee_id" && Boolean(resId)) {
                        return [resId];
                    }
                }
                return [];
            },
            getRange: () => this.model.getRange(),
        });
        this.onRegenerateWorkEntries = onRegenerateWorkEntries;
    }
}
