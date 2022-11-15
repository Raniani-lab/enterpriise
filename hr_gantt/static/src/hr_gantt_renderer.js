/* @odoo-module */

import { Avatar } from "@mail/web/fields/avatar/avatar";
import { GanttRenderer } from "@web_gantt/gantt_renderer";

export class HrGanttRenderer extends GanttRenderer {
    computeDerivedParams() {
        this.rowsWithAvatar = {};
        super.computeDerivedParams();
    }

    getAvatarProps(row) {
        return this.rowsWithAvatar[row.id];
    }

    hasAvatar(row) {
        return row.id in this.rowsWithAvatar;
    }

    processRow(row) {
        const { groupedByField, name, resId } = row;
        if (groupedByField === "employee_id" && Boolean(resId)) {
            const { fields } = this.model.metaData;
            const resModel = fields.employee_id.relation;
            this.rowsWithAvatar[row.id] = { resModel, resId, displayName: name };
        }
        return super.processRow(...arguments);
    }
}
HrGanttRenderer.rowHeaderTemplate = "hr.HrGanttRenderer.RowHeader";
HrGanttRenderer.components = { ...GanttRenderer.components, Avatar };
