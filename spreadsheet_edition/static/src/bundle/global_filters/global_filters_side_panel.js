/** @odoo-module */

import DateFilterValue from "@spreadsheet_edition/assets/components/filter_date_value";
import { X2ManyTagSelector } from "@spreadsheet_edition/assets/widgets/tag_selector_widget";
import { getPeriodOptions } from "@web/search/utils/dates";
import { LegacyComponent } from "@web/legacy/legacy_component";

const { DateTime } = luxon;

/**
 * This is the side panel to define/edit a global filter.
 * It can be of 3 different type: text, date and relation.
 */
export default class GlobalFiltersSidePanel extends LegacyComponent {
    setup() {
        this.periodOptions = getPeriodOptions(DateTime.local());
        this.getters = this.env.model.getters;
    }

    get isReadonly() {
        return this.env.model.getters.isReadonly();
    }

    get filters() {
        return this.env.model.getters.getGlobalFilters();
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

    onClear(id) {
        this.env.model.dispatch("CLEAR_GLOBAL_FILTER_VALUE", { id });
    }

    onDateInput(id, value) {
        this.env.model.dispatch("SET_GLOBAL_FILTER_VALUE", { id, value });
    }

    onTextInput(id, value) {
        this.env.model.dispatch("SET_GLOBAL_FILTER_VALUE", { id, value });
    }

    onTagSelected(id, values) {
        this.env.model.dispatch("SET_GLOBAL_FILTER_VALUE", {
            id,
            value: values.map((record) => record.id),
            displayNames: values.map((record) => record.display_name),
        });
    }

    onDelete() {
        if (this.id) {
            this.env.model.dispatch("REMOVE_GLOBAL_FILTER", { id: this.id });
        }
        this.trigger("close-side-panel");
    }
}
GlobalFiltersSidePanel.template = "spreadsheet_edition.GlobalFiltersSidePanel";
GlobalFiltersSidePanel.components = { X2ManyTagSelector, DateFilterValue };
