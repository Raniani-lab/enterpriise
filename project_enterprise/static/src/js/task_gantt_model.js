/** @odoo-module **/

import GanttModel from 'web_gantt.GanttModel';
import { _t } from 'web.core';

export const TaskGanttModel = GanttModel.extend({
    /**
     * @private
     * @override
     */
    _generateRows(params) {
        const { groupedBy, groups, parentPath } = params;
        if (groupedBy.length) {
            const groupedByField = groupedBy[0];
            if (groupedByField === 'user_id') {
                // Here we are generating some rows under a common "parent" (if any).
                // We make sure that a row with resId = false for "user_id"
                // ('Unassigned Tasks') and same "parent" will be added by adding
                // a suitable fake group to groups (a subset of the groups returned
                // by read_group).
                const fakeGroup = Object.assign({}, ...parentPath);
                groups.push(fakeGroup);
            }
        }
        const rows = this._super(params);
        // always move an empty row to the head
        if (groupedBy && groupedBy.length && rows.length > 1 && rows[0].resId) {
            this._reorderEmptyRow(rows);
        }
        return rows;
    },
    /**
     * @private
     * @override
     */
    _getRowName(groupedByField, value) {
        if (groupedByField === "user_id") {
            const resId = Array.isArray(value) ? value[0] : value;
            if (!resId) {
                return _t("Unassigned Tasks");
            }
        }
        return this._super(...arguments);
    },
    /**
     * Find an empty row and move it at the head of the array.
     *
     * @private
     * @param {Object[]} rows
     */
    _reorderEmptyRow(rows) {
        let emptyIndex = null;
        for (let i = 0; i < rows.length; ++i) {
            if (!rows[i].resId) {
                emptyIndex = i;
                break;
            }
        }
        if (emptyIndex) {
            const emptyRow = rows.splice(emptyIndex, 1)[0];
            rows.unshift(emptyRow);
        }
    },
});
