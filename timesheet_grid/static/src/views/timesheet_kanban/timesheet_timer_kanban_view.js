/** @odoo-module */

import { registry } from "@web/core/registry";
import { kanbanView } from "@web/views/kanban/kanban_view";
import { TimesheetTimerKanbanRenderer } from "./timesheet_timer_kanban_renderer";

export const timesheetTimerKanbanView = {
    ...kanbanView,
    Renderer: TimesheetTimerKanbanRenderer,
};

registry.category("views").add("timesheet_timer_kanban", timesheetTimerKanbanView);
