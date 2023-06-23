/** @odoo-module **/

import { registry } from "@web/core/registry";
import { stepUtils } from "@web_tour/tour_service/tour_utils";

function openProjectUpdateAndReturnToTasks(view, viewClass) {
    return [{
            trigger: '.o_project_updates_breadcrumb',
            content: 'Open Project Update from view : ' + view,
            extra_trigger: "." + viewClass,
        }, {
            trigger: ".o-kanban-button-new",
            content: "Create a new update from project task view : " + view,
            extra_trigger: '.o_project_update_kanban_view',
        }, {
            trigger: "button.o_form_button_cancel",
            content: "Discard project update from project task view : " + view,
        }, {
            trigger: ".o_switch_view.o_list",
            content: "Go to list of project update from view " + view,
        }, {
            trigger: '.o_back_button',
            content: 'Go back to the task view : ' + view,
            // extra_trigger: '.o_list_table', // FIXME: [XBO] uncomment it when sample data will be displayed after discarding creation of project update record.
        },
    ];
}

registry.category("web_tour.tours").add('project_enterprise_tour', {
    test: true,
    url: '/web',
    steps: [
    stepUtils.showAppsMenuItem(), {
        trigger: '.o_app[data-menu-xmlid="project.menu_main_pm"]',
    }, {
        trigger: '.o-kanban-button-new',
        extra_trigger: '.o_project_kanban',
        width: 200,
    }, {
        trigger: '.o_project_name input',
        run: 'text New Project'
    }, {
        trigger: 'div[name="allow_billable"] input',
        run: 'click',
    }, {
        trigger: '.o_open_tasks',
        run: function (actions) {
            actions.auto('.modal:visible .btn.btn-primary');
        },
    }, {
        trigger: ".o_kanban_project_tasks .o_column_quick_create .input-group",
        run: function (actions) {
            actions.text("New", this.$anchor.find("input"));
        },
    }, {
        trigger: ".o_kanban_project_tasks .o_column_quick_create .o_kanban_add",
        auto: true,
    }, {
        trigger: ".o_kanban_project_tasks .o_column_quick_create .input-group",
        extra_trigger: '.o_kanban_group',
        run: function (actions) {
            actions.text("Done", this.$anchor.find("input"));
        },
    }, {
        trigger: ".o_kanban_project_tasks .o_column_quick_create .o_kanban_add",
        auto: true,
    }, {
        trigger: '.o-kanban-button-new',
        extra_trigger: '.o_kanban_group:eq(0)'
    }, {
        trigger: '.o_kanban_quick_create div.o_field_char[name=display_name] input',
        extra_trigger: '.o_kanban_project_tasks',
        run: 'text New task'
    }, {
        trigger: '.o_kanban_quick_create .o_kanban_add',
        extra_trigger: '.o_kanban_project_tasks'
    }, {
        trigger: '.o_switch_view.o_gantt',
        content: 'Open Gantt View',
    }, {
        trigger: '.o_gantt_button_add',
        content: 'Add a task in gantt',
    }, {
        trigger: '.o_field_text[name="name"] textarea',
        content: 'Set task name',
        run: 'text New task',
    }, {
        trigger: 'div[name="user_ids"].o_field_many2many_tags_avatar input',
        content: 'Assign the task to you',
        run: 'click',
    }, {
        trigger: 'ul.ui-autocomplete a .o_avatar_many2x_autocomplete',
        content: 'Assign the task to you',
    }, {
        trigger: 'a[name="sub_tasks_page"]',
        content: 'Open sub-tasks notebook section',
        run: 'click',
    }, {
        trigger: '.o_field_subtasks_one2many .o_list_renderer a[role="button"]',
        content: 'Add a subtask',
        run: 'click',
    }, {
        trigger: '.o_field_subtasks_one2many div[name="name"] input',
        content: 'Set subtask name',
        run: 'text new subtask'
    }, {
        trigger: 'button[special="save"]',
        extra_trigger: '.o_field_many2many_tags_avatar .o_m2m_avatar',
        content: 'Save task',
    }, {
        trigger: ".o_gantt_progress_bar",
        content: "See user progress bar",
        run: function () {
            const $progressbar = $(".o_gantt_progress_bar:eq(0)");
            if ($progressbar.length) {
                if ($progressbar.find("span:eq(0)")[0].style.width === '') {
                    console.error("Progress bar should be displayed");
                }
                if (!$progressbar[0].classList.contains("o_gantt_group_danger")) {
                    console.error("Progress bar should be displayed in danger");
                }
            } else {
                console.error("Not able to select progressbar");
            }
        }
    }, ...openProjectUpdateAndReturnToTasks("Gantt", "o_gantt_view"), {
        trigger: '.o_switch_view.o_map',
        content: 'Open Map View',
    }, ...openProjectUpdateAndReturnToTasks("Map", "o_map_view"),
]});
