/** @odoo-module */

import { registry } from "@web/core/registry";
import { openCommandBar } from "../knowledge_tour_utils.js";
import { stepUtils } from "@web_tour/tour_service/tour_utils";

registry.category("web_tour.tours").add("knowledge_search_favorites_tour", {
    url: "/web",
    test: true,
    steps: [
        stepUtils.showAppsMenuItem(),
        {
            // open the Knowledge App
            trigger: ".o_app[data-menu-xmlid='knowledge.knowledge_menu_root']",
        },
        {
            trigger: ".o_field_html",
            run: function () {
                const header = document.querySelector(".o_breadcrumb_article_name input");
                if (header.value !== "Article 1") {
                    console.error(`Wrong article: ${header.value}`);
                }
            },
        },
        // Create the first Kanban
        {
            trigger: ".odoo-editor-editable > h1",
            run: function () {
                openCommandBar(this.$anchor[0]);
            },
        },
        {
            trigger: ".oe-powerbox-commandName:contains('Item Kanban')",
        },
        {
            trigger: ".modal-body input.form-control",
            run: "text Items 1",
        },
        {
            trigger: "button:contains('Insert')",
        },
        // Create the second Kanban
        {
            trigger: ".odoo-editor-editable > h1",
            run: function () {
                openCommandBar(this.$anchor[0]);
            },
        },
        {
            trigger: ".oe-powerbox-commandName:contains('Item Kanban')",
        },
        {
            trigger: ".modal-body input.form-control",
            run: "text Items 2",
        },
        {
            trigger: "button:contains('Insert')",
        },
        // Search on the first kanban
        {
            trigger: ".o_knowledge_embedded_view:has(span:contains('Items 1')) .o_searchview_input",
            extra_trigger: "span:contains('Items 2')", // wait for kanban 2 to be inserted
            run: "text 1",
        },
        {
            trigger: ".o_dropdown_title:contains('Favorites')",
        },
        {
            trigger: ".o_favorite_menu .o_add_favorite button",
            run: function () {
                this.$anchor[0].dispatchEvent(new Event("mouseenter"));
            },
        },
        {
            // use by default
            trigger: ".o_favorite_menu .o-checkbox input",
        },
        {
            trigger: ".o_favorite_menu .o_save_favorite",
        },
        {
            // check that the search item has been added
            trigger: ".o_facet_value",
            run: function () {
                const items = document.querySelectorAll(".o_facet_value");
                if (items.length !== 1) {
                    console.error("The search should be applied only on the first view");
                } else if (items[0].innerText !== "Items 1") {
                    console.error(`Wrong favorite name: ${items[0].innerText}`);
                }
            },
        },
        // Open the favorite of the second kanban and check it has no favorite
        // (favorite are defined per view)
        {
            trigger: ".breadcrumb:contains('Items 2')",
            run: function () {
                const view = this.$anchor[0].closest(
                    ".o_knowledge_article_view_kanban_embedded_view"
                );
                const favoriteButton = view.querySelector(".o_favorite_menu button");
                favoriteButton.click();
            },
        },
        {
            trigger: ".o_search_options .dropdown-item",
            run: function () {
                const items = document.querySelectorAll(".o_search_options .dropdown-item");
                if (items.length !== 1 || items[0].innerText !== "Save current search") {
                    console.error("The favorite should not be available for the second view");
                }
            },
        },
    ],
});
