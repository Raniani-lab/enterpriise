/** @odoo-module **/

import { device } from 'web.config';
import { format } from 'web.field_utils';
import GanttModel from 'web_gantt.GanttModel';
import { _t } from 'web.core';


const TaskGanttModel = GanttModel.extend({

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     * @override
     */
    _fetchData() {
        return this._super(...arguments).then((result) => {
            this.ganttData.milestones = [];
            if (this.isSampleModel || device.isMobile) {
                return Promise.resolve();
            }
            return this._rpc({
                model: 'project.task',
                method: 'read_group',
                fields: ['project_id'],
                domain: this.domain,
                groupBy: ['project_id'],
            }).then((result) => {
                const projectIds = result.map((read_group_entry) => read_group_entry.project_id[0]);
                if (!projectIds.length) {
                    return Promise.resolve();
                }
                return this._rpc({
                    model: 'project.milestone',
                    method: 'search_read',
                    domain: [
                        ['project_id', 'in', projectIds],
                        ['deadline', '<=', this.convertToServerTime(this.ganttData.stopDate)],
                        ['deadline', '>=', this.convertToServerTime(this.ganttData.startDate)],
                    ],
                    fields: ['name', 'deadline', 'is_deadline_exceeded', 'is_reached', 'project_id'],
                    orderBy: [{ name: 'project_id', asc: true }, { name: 'deadline', asc: true }]
                }).then((milestones) => {
                    this.ganttData.milestones = milestones.map(milestone => {
                        return Object.assign(
                            milestone,
                            {
                                'deadlineUserFormatted': format.date(moment(milestone.deadline)),
                                // Ensure milestones are displayed at the end of the period.
                                'deadline': moment(milestone.deadline).clone().add(1, 'd').subtract(1, 'ms'),
                            },
                        );
                    });
                });
            });
        });
    },
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

export default TaskGanttModel;
