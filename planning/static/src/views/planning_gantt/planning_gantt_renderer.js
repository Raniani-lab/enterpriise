/* @odoo-module */

import { formatFloat, formatFloatTime } from "@web/views/fields/formatters";
import { GanttRenderer } from "@web_gantt/gantt_renderer";
import { getUnionOfIntersections } from "@web_gantt/gantt_helpers";
import { PlanningEmployeeAvatar } from "./planning_employee_avatar";
import { PlanningGanttRowProgressBar } from "./planning_gantt_row_progress_bar";
import { useEffect } from "@odoo/owl";

const { Duration } = luxon;

export class PlanningGanttRenderer extends GanttRenderer {
    setup() {
        super.setup();
        useEffect(() => {
            this.rootRef.el.classList.add("o_planning_gantt");
        });
    }

    /**
     * @override
     */
    addTo(pill, group) {
        if (!pill.allocatedHours[group.col]) {
            return false;
        }
        group.pills.push(pill);
        group.aggregateValue += pill.allocatedHours[group.col];
        if (group.col === this.getFirstcol(pill)) {
            group.aggregateValue += pill.allocatedHours[group.col - 1] || 0;
        }
        if (group.col === this.getLastCol(pill)) {
            group.aggregateValue += pill.allocatedHours[group.col + 1] || 0;
        }
        return true;
    }

    computeDerivedParams() {
        this.rowsWithAvatar = {};
        super.computeDerivedParams();
    }

    /**
     * @override
     */
    enrichPill() {
        const pill = super.enrichPill(...arguments);
        const { record } = pill;
        pill.allocatedHours = {};
        const percentage = record.allocated_percentage ? record.allocated_percentage / 100 : 0;
        if (percentage === 0) {
            return pill;
        }
        if (this.isFlexibleHours(record)) {
            for (let col = this.getFirstcol(pill); col < this.getLastCol(pill) + 1; col++) {
                const subColumn = this.subColumns[col - 1];
                if (!subColumn) {
                    continue;
                }
                const { start, stop } = subColumn;
                const maxDuration = stop.diff(start);
                const toMillisRatio = 60 * 60 * 1000;
                const dailyAllocHours = Math.min(record.allocated_hours * toMillisRatio / pill.grid.column[1], maxDuration);
                if (dailyAllocHours) {
                    let minutes = Duration.fromMillis(dailyAllocHours * percentage).as("minute");
                    minutes = Math.round(minutes / 5) * 5;
                    pill.allocatedHours[col] = Duration.fromObject({ minutes }).as("hour");
                }
            }
            return pill;
        }
        const recordIntervals = this.getRecordIntervals(record);
        if (!recordIntervals.length) {
            return pill;
        }
        for (let col = this.getFirstcol(pill) - 1; col <= this.getLastCol(pill) + 1; col++) {
            const subColumn = this.subColumns[col - 1];
            if (!subColumn) {
                continue;
            }
            const { start, stop } = subColumn;
            const interval = [start, stop.plus({ seconds: 1 })];
            const union = getUnionOfIntersections(interval, recordIntervals);
            let duration = 0;
            for (const [otherStart, otherEnd] of union) {
                duration += otherEnd.diff(otherStart);
            }
            if (duration) {
                let minutes = Duration.fromMillis(duration * percentage).as("minute");
                minutes = Math.round(minutes / 5) * 5;
                pill.allocatedHours[col] = Duration.fromObject({ minutes }).as("hour");
            }
        }
        return pill;
    }

    getAvatarProps(row) {
        return this.rowsWithAvatar[row.id];
    }

    /**
     * @override
     */
    getAggregateValue(group, previousGroup) {
        return group.aggregateValue + previousGroup.aggregateValue;
    }

    /**
     * @override
     */
    getColumnStartStop(columnIndex) {
        const { scale } = this.model.metaData;
        if (["week", "month"].includes(scale.id)) {
            const { start } = this.columns[columnIndex];
            return {
                start: start.set({ hours: 8, minutes: 0, seconds: 0 }),
                stop: start.set({ hours: 17, minutes: 0, seconds: 0 }),
            };
        }
        return super.getColumnStartStop(...arguments);
    }

    /**
     * @override
     */
    getGroupPillDisplayName(pill) {
        return formatFloatTime(pill.aggregateValue);
    }

    /**
     * @override
     */
    getPopoverProps(pill) {
        const popoverProps = super.getPopoverProps(pill);
        if (this.popoverTemplate) {
            const { record } = pill;
            Object.assign(popoverProps.context, {
                allocatedHoursFormatted:
                    record.allocated_hours && formatFloatTime(record.allocated_hours),
                allocatedPercentageFormatted:
                    record.allocated_percentage && formatFloat(record.allocated_percentage),
            });
        }
        return popoverProps;
    }

    /**
     * @param {RelationalRecord} record
     * @returns {any[]}
     */
    getRecordIntervals(record) {
        const val = record.resource_id;
        const resourceId = Array.isArray(val) ? val[0] : false;
        const startTime = record.start_datetime;
        const endTime = record.end_datetime;
        if (!this.model.data.workIntervals) {
            return [];
        }
        const resourceIntervals = this.model.data.workIntervals[resourceId];
        if (!resourceIntervals) {
            return [];
        }
        const recordIntervals = getUnionOfIntersections([startTime, endTime], resourceIntervals);
        return recordIntervals;
    }

    /**
     * @param {RelationalRecord} record
     * @returns {boolean}
     */
    isFlexibleHours(record) {
        return this.model.data.isFlexibleHours?.[record.resource_id[0]];
    }

    /**
     * @override
     */
    getSelectCreateDialogProps() {
        return {
            ...super.getSelectCreateDialogProps(...arguments),
            noCreate: true,
        };
    }

    hasAvatar(row) {
        return row.id in this.rowsWithAvatar;
    }

    /**
     * @override
     */
    isDisabled(row) {
        if (!row.fromServer) {
            return false;
        }
        return super.isDisabled(...arguments);
    }

    /**
     * @override
     */
    isHoverable(row) {
        if (!row.fromServer) {
            return !row.isGroup;
        }
        return super.isHoverable(...arguments);
    }

    processRow(row) {
        const { fromServer, groupedByField, name, progressBar } = row;
        const isGroupedByResource = groupedByField === "resource_id";
        const employeeId = progressBar && progressBar.employee_id;
        const isResourceMaterial = progressBar && progressBar.is_material_resource;
        const showEmployeeAvatar =
            !isResourceMaterial && isGroupedByResource && fromServer && Boolean(employeeId);
        if (showEmployeeAvatar) {
            const { fields } = this.model.metaData;
            const resModel = fields.employee_id.relation;
            this.rowsWithAvatar[row.id] = { resModel, resId: employeeId, displayName: name };
        }
        return super.processRow(...arguments);
    }

    /**
     * @override
     */
    shouldMergeGroups() {
        return false;
    }
}
PlanningGanttRenderer.rowHeaderTemplate = "planning.PlanningGanttRenderer.RowHeader";
PlanningGanttRenderer.components = {
    ...GanttRenderer.components,
    Avatar: PlanningEmployeeAvatar,
    GanttRowProgressBar: PlanningGanttRowProgressBar,
};
