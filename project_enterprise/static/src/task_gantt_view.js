/** @odoo-module **/

import { ganttView } from "@web_gantt/gantt_view";
import { ProjectControlPanel } from "@project/components/project_control_panel/project_control_panel";
import { registry } from "@web/core/registry";
import { TaskGanttArchParser } from "./task_gantt_arch_parser";
import { TaskGanttModel } from "./task_gantt_model";
import { TaskGanttRenderer } from "./task_gantt_renderer";

const viewRegistry = registry.category("views");

const taskGanttView = {
    ...ganttView,
    ControlPanel: ProjectControlPanel,
    ArchParser: TaskGanttArchParser,
    Model: TaskGanttModel,
    Renderer: TaskGanttRenderer,
};

viewRegistry.add("task_gantt", taskGanttView);
