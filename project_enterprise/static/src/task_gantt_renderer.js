/** @odoo-module **/

import { _t } from "@web/core/l10n/translation";
import { Avatar } from "@mail/views/web/fields/avatar/avatar";
import { markup, useEffect } from "@odoo/owl";
import { localization } from "@web/core/l10n/localization";
import { usePopover } from "@web/core/popover/popover_hook";
import { useService } from "@web/core/utils/hooks";
import { GanttRenderer } from "@web_gantt/gantt_renderer";
import { MilestonesPopover } from "./milestones_popover";

export class TaskGanttRenderer extends GanttRenderer {
    setup() {
        super.setup(...arguments);
        this.notificationService = useService("notification");
        useEffect(
            (el) => el.classList.add("o_project_gantt"),
            () => [this.rootRef.el]
        );
        const position = localization.direction === "rtl" ? "bottom" : "right";
        this.milestonePopover = usePopover(MilestonesPopover, { position });
    }

    computeColumns() {
        super.computeColumns();
        this.columnMilestones = {};
        for (const column of this.columns) {
            this.columnMilestones[column.id] = {
                hasDeadLineExceeded: false,
                allReached: true,
                milestones: [],
            };
        }
        let index = 0;
        for (const m of this.model.data.milestones) {
            const { is_deadline_exceeded, is_reached } = m;
            for (let i = index; i < this.columns.length - 1; i++) {
                const column = this.columns[i];
                if (column.stop < m.deadline) {
                    index++;
                    continue;
                } else {
                    const info = this.columnMilestones[column.id];
                    info.milestones.push(m);
                    if (is_deadline_exceeded) {
                        info.hasDeadLineExceeded = true;
                    }
                    if (!is_reached) {
                        info.allReached = false;
                    }
                    break;
                }
            }
        }
    }

    computeDerivedParams() {
        this.rowsWithAvatar = {};
        super.computeDerivedParams();
    }

    getConnectorAlert(masterRecord, slaveRecord) {
        if (
            masterRecord.display_warning_dependency_in_gantt &&
            slaveRecord.display_warning_dependency_in_gantt
        ) {
            return super.getConnectorAlert(...arguments);
        }
    }

    getPopoverProps(pill) {
        const props = super.getPopoverProps(...arguments);
        const { record } = pill;
        if (record.planning_overlap) {
            props.context.planningOverlapHtml = markup(record.planning_overlap);
        }
        return props;
    }

    getAvatarProps(row) {
        return this.rowsWithAvatar[row.id];
    }

    getSelectCreateDialogProps() {
        const props = super.getSelectCreateDialogProps(...arguments);
        props.context.smart_task_scheduling = true;
        return props;
    }

    hasAvatar(row) {
        return row.id in this.rowsWithAvatar;
    }

    openPlanDialogCallback(res) {
        if (res) {
            if (res.action) {
                this.actionService.doAction(res.action);
            } else if (res.warnings) {
                for (const warning of res.warnings) {
                    this.notificationService.add(warning, {
                        title: _t("Warning"),
                        type: "warning",
                        sticky: true,
                    });
                }
            }
        }
    }

    processRow(row) {
        const { groupedByField, name, resId } = row;
        if (groupedByField === "user_ids" && Boolean(resId)) {
            const { fields } = this.model.metaData;
            const resModel = fields.user_ids.relation;
            this.rowsWithAvatar[row.id] = { resModel, resId, displayName: name };
        }
        return super.processRow(...arguments);
    }

    shouldRenderRecordConnectors(record) {
        if (record.allow_task_dependencies) {
            return super.shouldRenderRecordConnectors(...arguments);
        }
        return false;
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    onMilestoneMouseEnter(ev, milestones) {
        this.milestonePopover.open(ev.target, {
            milestones,
            displayMilestoneDates: this.model.metaData.scale.id === "year",
            displayProjectName: !this.model.searchParams.context.default_project_id,
        });
    }

    onMilestoneMouseLeave() {
        this.milestonePopover.close();
    }
}
TaskGanttRenderer.components = {
    ...GanttRenderer.components,
    Avatar,
};
TaskGanttRenderer.headerTemplate = "project_enterprise.TaskGanttRenderer.Header";
TaskGanttRenderer.rowHeaderTemplate = "project_enterprise.TaskGanttRenderer.RowHeader";
TaskGanttRenderer.rowContentTemplate = "project_enterprise.TaskGanttRenderer.RowContent";
TaskGanttRenderer.totalRowTemplate = "project_enterprise.TaskGanttRenderer.TotalRow";
