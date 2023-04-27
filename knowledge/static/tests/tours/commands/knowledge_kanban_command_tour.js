/** @odoo-module */

import { registry } from "@web/core/registry";
import { openCommandBar } from '../knowledge_tour_utils.js';
import { stepUtils } from "@web_tour/tour_service/tour_utils";

registry.category("web_tour.tours").add('knowledge_kanban_cards_command_tour', {
    url: '/web',
    test: true,
    steps: [stepUtils.showAppsMenuItem(), { // open the Knowledge App
    trigger: '.o_app[data-menu-xmlid="knowledge.knowledge_menu_root"]',
}, { // open the command bar
    trigger: '.odoo-editor-editable > p',
    run: function () {
        openCommandBar(this.$anchor[0]);
    },
}, { // click on the /kanban command
    trigger: '.oe-powerbox-commandName:contains("Item Cards")',
    run: 'click',
},
...commonKanbanSteps(),
{ // create an article item
    trigger: '.o_knowledge_behavior_type_embedded_view .o-kanban-button-new',
    run: 'click',
}, { // verify that the view switched to the article item
    trigger: '.o_knowledge_header:has(input[id="name"]:placeholder-shown):has(.breadcrumb-item > a:contains("EditorCommandsArticle"))',
    run: () => {},
}]});

registry.category("web_tour.tours").add('knowledge_kanban_command_tour', {
    url: '/web',
    test: true,
    steps: [stepUtils.showAppsMenuItem(), { // open the Knowledge App
    trigger: '.o_app[data-menu-xmlid="knowledge.knowledge_menu_root"]',
}, { // open the command bar
    trigger: '.odoo-editor-editable > p',
    run: function () {
        openCommandBar(this.$anchor[0]);
    },
}, { // click on the /kanban command
    trigger: '.oe-powerbox-commandName:contains("Item Kanban")',
    run: 'click',
},
...commonKanbanSteps(),
{ // Check that the stages are well created
    trigger: '.o_knowledge_behavior_type_embedded_view .o_kanban_renderer .o_kanban_group .o_kanban_header_title:contains("Ongoing")',
    run: () => {},
}, { // create an article item from Main New button
    trigger: '.o_knowledge_behavior_type_embedded_view .o-kanban-button-new',
    run: 'click',
}, { // Type a Title for new article in the quick create form
    trigger: '.o_knowledge_behavior_type_embedded_view .o_kanban_renderer .o_kanban_quick_create .o_input',
    run: 'text New Quick Create Item',
}, { // Click on Add to create the article
    trigger: '.o_knowledge_behavior_type_embedded_view .o_kanban_renderer .o_kanban_quick_create .o_kanban_add',
    run: 'click'
}, { // Verify that the article has been properly created
    trigger: '.o_knowledge_behavior_type_embedded_view .o_kanban_renderer .o_kanban_record_title span:contains("New Quick Create Item")',
    run: () => {},
}, { // Create a new article using quick create in OnGoing Column
    trigger: '.o_knowledge_behavior_type_embedded_view .o_kanban_renderer .o_kanban_group .o_kanban_header_title:contains("Ongoing") .o_kanban_quick_add',
    run: 'click'
}, { // Type a Title for new article in the quick create form
    trigger: '.o_knowledge_behavior_type_embedded_view .o_kanban_renderer .o_kanban_group:has(.o_kanban_header_title:contains("Ongoing")) .o_kanban_quick_create .o_input',
    run: 'text Quick Create Ongoing Item',
}, { // Click on Edit to open the article in edition in his own form view
    trigger: '.o_knowledge_behavior_type_embedded_view .o_kanban_renderer .o_kanban_quick_create .o_kanban_edit',
    run: 'click'
}, { // verify that the view switched to the article item
    trigger: '.o_knowledge_header .o_breadcrumb_article_name_container:contains("Quick Create Ongoing Item")',
    run: () => {},
}]});

function commonKanbanSteps () {
    return [
        { // choose a name for the embedded view
            trigger: '.modal-footer button.btn-primary',
            run: 'click',
        }, { // scroll to the embedded view to load it
            trigger: '.o_knowledge_behavior_type_embedded_view',
            run: function () {
                this.$anchor[0].scrollIntoView();
            },
        }, { // wait for the kanban view to be mounted
            trigger: '.o_knowledge_behavior_type_embedded_view .o_kanban_renderer',
            run: () => {
                const helpField = document.querySelector('.o_knowledge_content[data-prop-name="action_help"]');
                if (!helpField) {
                    throw new Error('Help field was not rendered in the DOM');
                }
                // allow further modifications of the help field for testing
                helpField.classList.remove('d-none');
            },
        }, { // modify the help message in the dom
            trigger: '.o_knowledge_content[data-prop-name="action_help"] > p',
            run: function () {
                this.$anchor[0].textContent = "Test help message";
            }
        }, { // create an article to switch to
            trigger: '.o_section_header:contains(Workspace) .o_section_create',
            run: 'click'
        }, { // check that the article is correctly created
            trigger: '.odoo-editor-editable > h1',
            run: () => {},
        }, { // switch back to the first article
            trigger: '.o_knowledge_tree .o_article_name:contains("EditorCommandsArticle")',
            run: 'click',
        }, { // scroll to load
            trigger: '.o_knowledge_behavior_type_embedded_view',
            run: function () {
                this.$anchor[0].scrollIntoView();
            }
        }, { // wait for the kanban view to be mounted
            trigger: '.o_knowledge_behavior_type_embedded_view .o_kanban_renderer',
            run: () => {}
        }, { // open the view
            trigger: '.o_knowledge_toolbar button:contains(Open)',
            run: 'click'
        }, { // verify that the help message is displayed
            trigger: '.o_action_manager > .o_view_controller.o_kanban_view .o_nocontent_help:contains("Test help message")',
            run: () => {}
        }, { // go back to the first view
            trigger: '.breadcrumb a:contains("EditorCommandsArticle")',
            run: 'click',
        }, { // scroll to the embedded view to load it
            trigger: '.o_knowledge_behavior_type_embedded_view',
            run: function () {
                this.$anchor[0].scrollIntoView();
            },
        }, { // wait for the kanban view to be mounted
            trigger: '.o_knowledge_behavior_type_embedded_view .o_kanban_renderer',
            run: () => {
                const helpField = document.querySelector('.o_knowledge_content[data-prop-name="action_help"]');
                if (!helpField) {
                    throw new Error('Help field was not rendered in the DOM');
                }
                // focus the body otherwise change will not be saved
                document.querySelector("#body_0").focus();
                // remove the help field from the dom for testing
                helpField.remove();
            },
        }, { // switch back to the first article
            trigger: '.o_knowledge_tree .o_article_name:contains("Untitled")',
            run: 'click',
        }, { // check that the article is loaded
            trigger: '.odoo-editor-editable > h1',
            run: () => {},
        }, { // reswitch to the other article
            trigger: '.o_knowledge_tree .o_article_name:contains("EditorCommandsArticle")',
            run: 'click',
        }, { // scroll to the embedded view to load it
            trigger: '.o_knowledge_behavior_type_embedded_view',
            run: function () {
                this.$anchor[0].scrollIntoView();
            },
        }, { // wait for the kanban view to be mounted
            trigger: '.o_knowledge_behavior_type_embedded_view .o_kanban_renderer',
            run: () => {},
        }, { // open the view
            trigger: '.o_knowledge_toolbar button:contains(Open)',
            run: 'click'
        }, { // verify that the default help message is displayed
            trigger: '.o_action_manager > .o_view_controller.o_kanban_view .o_nocontent_help:contains("No data to display")',
            run: () => {}
        }, { // go back to the first view
            trigger: '.breadcrumb a:contains("EditorCommandsArticle")',
            run: 'click',
        }
    ];
};
