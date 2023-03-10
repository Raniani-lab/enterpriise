/** @odoo-module**/

import { registry } from "@web/core/registry";
import { stepUtils } from "@web_tour/tour_service/tour_utils";

registry.category("web_tour.tours").add("spreadsheet_clone_xlsx", {
    test: true,
    steps: [
        stepUtils.showAppsMenuItem(),
        {
            trigger: '.o_app[data-menu-xmlid="documents.menu_root"]',
            content: "Open document app",
        },
        {
            trigger: '.o_search_panel_label_title:contains("Test folder")',
            content: "Open Test folder workspace",
        },
        {
            trigger: ".o_document_xlsx",
            content: "Open xlsx card",
        },
        {
            trigger: "input#willArchive",
            content: "Uncheck sending to trash",
        },
        {
            trigger: ".modal-dialog footer button.btn-primary",
            content: "Open with Odoo Spreadsheet",
        },
        {
            trigger: ".o_menu_brand",
            content: "Go back to the menu",
        },
        {
            trigger: ".o_kanban_renderer .o_kanban_record:first:contains('test')",
            content: "Check a spreadsheet document was created",
            run: () => {
                const card = document.querySelectorAll(
                    ".o_kanban_renderer .o_kanban_record:nth-child(1) .o_document_spreadsheet"
                );
                if (!card.length) {
                    throw new Error("Missing spreadsheet document card.");
                }
            },
        },
        {
            trigger: ".o_document_xlsx",
            content: "Re-open the xlsx card",
        },
        {
            trigger: ".modal-dialog footer button.btn-primary",
            content: "Open with Odoo Spreadsheet without unchecking the box",
        },
        {
            trigger: ".o_menu_brand",
            content: "Go once more back to the menu",
        },
        {
            trigger: ".o_kanban_renderer .o_kanban_record",
            content: "Check XLSX is not visible",
            run: () => {
                const card = document.querySelectorAll(
                    ".o_kanban_renderer .o_kanban_record .o_document_xlsx"
                );
                if (card.length) {
                    throw new Error("XLSX document was not archived.");
                }
            },
        },
        {
            trigger: '.o_control_panel .o-dropdown .dropdown-toggle:contains("Filters")',
            content: "Open Filters",
        },
        {
            trigger: '.dropdown-item:contains("Archived")',
            content: "Show Archived",
        },
        {
            trigger: ".o_document_xlsx",
            content: "Re-open the xlsx card",
        },
        {
            trigger: ".modal-dialog footer button.btn-primary",
            content: "Restore xlsx",
        },
        {
            trigger: ".o_kanban_renderer .o_kanban_record",
            content: "Check all records are now visible.",
            run: () => {
                const cards = document.querySelectorAll(
                    ".o_kanban_renderer .o_kanban_record:not(.o_kanban_ghost)"
                );
                if (cards.length !== 3) {
                    throw new Error("Unexpected number of records visible in current workspace.");
                }
            },
        },
    ],
});
