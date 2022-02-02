odoo.define("documents_spreadsheet.global_filters_side_panel", function (require) {
    "use strict";

    const DateFilterValue = require("documents_spreadsheet.DateFilterValue");
    const {
        TagSelectorWidget,
        TagSelectorWidgetAdapter,
    } = require("documents_spreadsheet.tag_selector_widget");
    const { getPeriodOptions } = require("web.searchUtils");

    const { Component } = owl;

    /**
     * This is the side panel to define/edit a global filter.
     * It can be of 3 different type: text, date and relation.
     */
    class GlobalFiltersSidePanel extends Component {
        setup() {
            this.TagSelectorWidget = TagSelectorWidget;
            this.periodOptions = getPeriodOptions(moment());
            this.getters = this.env.getters;
        }

        get isReadonly() {
            return this.env.getters.isReadonly();
        }

        get filters() {
            return this.env.getters.getGlobalFilters();
        }

        newText() {
            this.env.openSidePanel("FILTERS_SIDE_PANEL", { type: "text" });
        }

        newDate() {
            this.env.openSidePanel("FILTERS_SIDE_PANEL", { type: "date" });
        }

        newRelation() {
            this.env.openSidePanel("FILTERS_SIDE_PANEL", { type: "relation" });
        }

        onEdit(id) {
            this.env.openSidePanel("FILTERS_SIDE_PANEL", { id });
        }

        onDateInput(id, value) {
            this.env.dispatch("SET_GLOBAL_FILTER_VALUE", { id, value });
        }

        onTextInput(id, value) {
            this.env.dispatch("SET_GLOBAL_FILTER_VALUE", { id, value });
        }

        onTagSelected(id, values) {
            this.env.dispatch("SET_GLOBAL_FILTER_VALUE", {
                id,
                value: values.map((record) => record.id),
                displayNames: values.map((record) => record.display_name),
            });
        }

        onDelete() {
            if (this.id) {
                this.env.dispatch("REMOVE_GLOBAL_FILTER", { id: this.id });
            }
            this.trigger("close-side-panel");
        }
    }
    GlobalFiltersSidePanel.template = "documents_spreadsheet.GlobalFiltersSidePanel";
    GlobalFiltersSidePanel.components = { TagSelectorWidgetAdapter, DateFilterValue };

    return GlobalFiltersSidePanel;
});
