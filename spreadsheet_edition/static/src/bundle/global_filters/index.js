/** @odoo-module */

import { _t, _lt } from "@web/core/l10n/translation";

import spreadsheet from "@spreadsheet/o_spreadsheet/o_spreadsheet_extended";

import GlobalFiltersSidePanel from "./global_filters_side_panel";
import { FilterComponent } from "./filter_component";

import "./operational_transform";
import DateFilterEditorSidePanel from "./components/filter_editor/date_filter_editor_side_panel";
import TextFilterEditorSidePanel from "./components/filter_editor/text_filter_editor_side_panel";
import RelationFilterEditorSidePanel from "./components/filter_editor/relation_filter_editor_side_panel";

const { sidePanelRegistry, topbarComponentRegistry, cellMenuRegistry } = spreadsheet.registries;

sidePanelRegistry.add("DATE_FILTER_SIDE_PANEL", {
    title: _t("Filter properties"),
    Body: DateFilterEditorSidePanel,
});

sidePanelRegistry.add("TEXT_FILTER_SIDE_PANEL", {
    title: _t("Filter properties"),
    Body: TextFilterEditorSidePanel,
});

sidePanelRegistry.add("RELATION_FILTER_SIDE_PANEL", {
    title: _t("Filter properties"),
    Body: RelationFilterEditorSidePanel,
});

sidePanelRegistry.add("GLOBAL_FILTERS_SIDE_PANEL", {
    title: _t("Filters"),
    Body: GlobalFiltersSidePanel,
});

topbarComponentRegistry.add("filter_component", {
    component: FilterComponent,
    isVisible: (env) => {
        return !env.model.getters.isReadonly() || env.model.getters.getGlobalFilters().length;
    },
});

cellMenuRegistry.add("use_global_filter", {
    name: _lt("Set as filter"),
    sequence: 175,
    action(env) {
        const position = env.model.getters.getActivePosition();
        const cell = env.model.getters.getCell(position);
        const filters = env.model.getters.getFiltersMatchingPivot(cell.content);
        env.model.dispatch("SET_MANY_GLOBAL_FILTER_VALUE", { filters });
    },
    isVisible: (env) => {
        const position = env.model.getters.getActivePosition();
        const cell = env.model.getters.getCell(position);
        if (!cell) {
            return false;
        }
        const filters = env.model.getters.getFiltersMatchingPivot(cell.content);
        return filters.length > 0;
    },
});
