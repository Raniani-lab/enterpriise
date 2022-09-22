/** @odoo-module */

import { _t, _lt } from "@web/core/l10n/translation";
import spreadsheet from "@spreadsheet/o_spreadsheet/o_spreadsheet_extended";
import CommandResult from "@spreadsheet/o_spreadsheet/cancelled_reason";
import {
    FieldSelectorWidget,
    FieldSelectorAdapter,
} from "spreadsheet_edition.field_selector_widget";
import { RecordsSelector } from "@spreadsheet/global_filters/components/records_selector/records_selector";
import { useService } from "@web/core/utils/hooks";
import { LegacyComponent } from "@web/legacy/legacy_component";
import { ModelSelector } from "@web/core/model_selector/model_selector";
import { sprintf } from "@web/core/utils/strings";
import { FilterFieldOffset } from "./components/filter_field_offset";
import { RELATIVE_DATE_RANGE_TYPES } from "@spreadsheet/helpers/constants";
import { DateFilterValue } from "@spreadsheet/global_filters/components/filter_date_value/filter_date_value";

const { onMounted, onWillStart, useState } = owl;
const uuidGenerator = new spreadsheet.helpers.UuidGenerator();

const RANGE_TYPES = [
    { type: "year", description: _lt("Year") },
    { type: "quarter", description: _lt("Quarter") },
    { type: "month", description: _lt("Month") },
    { type: "relative", description: _lt("Relative Period") },
];

/**
 * @typedef {import("@spreadsheet/data_sources/metadata_repository").Field} Field
 * @typedef {import("@spreadsheet/global_filters/plugins/filters_plugin").FilterMatchingField} FilterMatchingField
 *
 * @typedef State
 * @property {boolean} saved
 * @property {string} label label of the filter
 * @property {"text" | "date" | "relation"} type type of the filter
 * @property {Object.<string, FilterMatchingField>} pivotFields map <pivotId, field matched by the global filter>
 * @property {Object.<string, FilterMatchingField>} listFields map <listId, field matched by the global filter>
 * @property {Object.<string, FilterMatchingField>} graphFields map <graphId, field matched by the global filter>
 * @property {Object} text config of text filter
 * @property {Object} date config of date filter
 * @property {Object} relation config of relation filter
 */

/**
 * This is the side panel to define/edit a global filter.
 * It can be of 3 different type: text, date and relation.
 */
export default class FilterEditorSidePanel extends LegacyComponent {
    /**
     * @constructor
     */
    setup() {
        this.id = undefined;
        /** @type {State} */
        this.state = useState({
            saved: false,
            label: undefined,
            type: this.props.type,
            pivotFields: {},
            listFields: {},
            graphFields: {},
            text: {
                defaultValue: undefined,
            },
            date: {
                defaultValue: {},
                defaultsToCurrentPeriod: false,
                type: "year", // "year" | "month" | "quarter" | "relative"
                options: [],
            },
            relation: {
                defaultValue: [],
                displayNames: [],
                relatedModel: {
                    label: undefined,
                    technical: undefined,
                },
            },
        });
        this.matcherDisplayNames = {
            pivots: {},
            lists: {},
            graph: {},
        };
        this.getters = this.env.model.getters;
        this.pivotIds = this.getters.getPivotIds();
        this.listIds = this.getters.getListIds();
        this.graphIds = this.getters.getOdooChartIds();
        this.loadValues();
        // Widgets
        this.FieldSelectorWidget = FieldSelectorWidget;
        this.orm = useService("orm");
        this.notification = useService("notification");

        this.relativeDateRangesTypes = RELATIVE_DATE_RANGE_TYPES;
        this.dateRangeTypes = RANGE_TYPES;

        onWillStart(this.onWillStart);
        onMounted(this.onMounted);
    }

    /**
     * Retrieve the placeholder of the label
     */
    get placeholder() {
        return sprintf(_t("New %s filter"), this.state.type);
    }

    get missingLabel() {
        return this.state.saved && !this.state.label;
    }

    get missingModel() {
        return (
            this.state.saved &&
            this.state.type === "relation" &&
            !this.state.relation.relatedModel.technical
        );
    }

    shouldDisplayFieldMatching() {
        return (
            this.pivotIds.length + this.listIds.length + this.graphIds.length &&
            (this.state.type !== "relation" || this.state.relation.relatedModel.technical)
        );
    }

    isDateTypeSelected(dateType) {
        return dateType === this.state.date.type;
    }

    /**
     * List of model names of all related models of all pivots
     * @returns {Array<string>}
     */
    get relatedModels() {
        const pivots = this.pivotIds.map((pivotId) =>
            Object.values(this.getters.getPivotDataSource(pivotId).getFields())
        );
        const lists = this.listIds.map((listId) =>
            Object.values(this.getters.getListDataSource(listId).getFields())
        );
        const graphs = this.graphIds.map((graphId) =>
            Object.values(this.getters.getGraphDataSource(graphId).getFields())
        );
        const all = pivots.concat(lists).concat(graphs);
        return [
            ...new Set(
                all
                    .flat()
                    .filter((field) => field.relation)
                    .map((field) => field.relation)
            ),
        ];
    }

    loadValues() {
        this.id = this.props.id;
        const globalFilter = this.id && this.getters.getGlobalFilter(this.id);
        if (globalFilter) {
            this.state.label = _t(globalFilter.label);
            this.state.type = globalFilter.type;
            this.state.date.type = globalFilter.rangeType;
            this.state.date.defaultsToCurrentPeriod = globalFilter.defaultsToCurrentPeriod;
            this.state.date.automaticDefaultValue = globalFilter.automaticDefaultValue;
            this.state[this.state.type].defaultValue = globalFilter.defaultValue;
            if (globalFilter.type === "relation") {
                this.state.relation.relatedModel.technical = globalFilter.modelName;
            }
        }
        this._loadFilterFields(globalFilter);
    }

    _loadFilterFields(globalFilter) {
        for (const pivotId of this.pivotIds) {
            const field = globalFilter && globalFilter.pivotFields[pivotId];
            if (field) {
                this.state.pivotFields[pivotId] = { ...field };
            }
        }
        for (const listId of this.listIds) {
            const field = globalFilter && globalFilter.listFields[listId];
            if (field) {
                this.state.listFields[listId] = { ...field };
            }
        }
        for (const graphId of this.graphIds) {
            const field = globalFilter && globalFilter.graphFields[graphId];
            if (field) {
                this.state.graphFields[graphId] = { ...field };
            }
        }
    }

    async onWillStart() {
        const proms = [];
        proms.push(this.fetchModelFromName());
        for (const pivotId of this.getters.getPivotIds()) {
            this.matcherDisplayNames.pivots[pivotId] = this.getters.getPivotName(pivotId);
            const dataSource = this.getters.getPivotDataSource(pivotId);
            proms.push(dataSource.loadMetadata());
        }
        for (const listId of this.listIds) {
            this.matcherDisplayNames.lists[listId] = this.getters.getListName(listId);
            const dataSource = this.getters.getListDataSource(listId);
            proms.push(dataSource.loadMetadata());
        }
        for (const graphId of this.graphIds) {
            const dataSource = this.getters.getGraphDataSource(graphId);
            proms.push(dataSource.loadMetadata());
            proms.push(
                dataSource
                    .getModelLabel()
                    .then((name) => (this.matcherDisplayNames.graph[graphId] = name))
            );
        }
        await Promise.all(proms);
    }

    onMounted() {
        this.el.querySelector(".o_global_filter_label").focus();
    }

    /**
     * Get the first field which could be a relation of the current related
     * model
     *
     * @param {Object.<string, Field>} fields Fields to look in
     * @returns {string|undefined}
     */
    _findRelation(fields) {
        const field = Object.values(fields).find(
            (field) => field.relation === this.state.relation.relatedModel.technical
        );
        return field.name;
    }

    async onModelSelected({ technical, label }) {
        if (!this.state.label) {
            this.state.label = label;
        }
        if (this.state.relation.relatedModel.technical !== technical) {
            this.state.relation.defaultValue = [];
        }
        this.state.relation.relatedModel.technical = technical;
        this.state.relation.relatedModel.label = label;
        for (const pivotId of this.pivotIds) {
            const fieldName = this._findRelation(
                this.getters.getPivotDataSource(pivotId).getFields()
            );
            this.selectedPivotField(pivotId, fieldName);
        }
        for (const listId of this.listIds) {
            const fieldName = this._findRelation(
                this.getters.getListDataSource(listId).getFields()
            );
            this.selectedListField(listId, fieldName);
        }
        for (const graphId of this.graphIds) {
            const fieldName = this._findRelation(
                this.getters.getGraphDataSource(graphId).getFields()
            );
            this.selectedGraphField(graphId, fieldName);
        }
    }

    async fetchModelFromName() {
        if (!this.state.relation.relatedModel.technical) {
            return;
        }
        const result = await this.orm.call("ir.model", "display_name_for", [
            [this.state.relation.relatedModel.technical],
        ]);
        this.state.relation.relatedModel.label = result[0] && result[0].display_name;
        if (!this.state.label) {
            this.state.label = this.state.relation.relatedModel.label;
        }
    }

    /**
     * @param {string} pivotId
     * @param {string|undefined} fieldName
     */
    selectedPivotField(pivotId, fieldName) {
        if (!fieldName) {
            delete this.state.pivotFields[pivotId];
            return;
        }
        const field = this.getters.getPivotDataSource(pivotId, fieldName).getField(fieldName);
        if (field) {
            this.state.pivotFields[pivotId] = {
                field: fieldName,
                type: field.type,
            };
            if (this.state.type === "date") {
                this.state.pivotFields[pivotId].offset = 0;
            }
        }
    }

    /**
     * @param {string} listId
     * @param {string} fieldName
     */
    selectedListField(listId, fieldName) {
        if (!fieldName) {
            delete this.state.listFields[listId];
            return;
        }
        const field = this.getters.getListDataSource(listId).getField(fieldName);
        if (field) {
            this.state.listFields[listId] = {
                field: fieldName,
                type: field.type,
            };
            if (this.state.type === "date") {
                this.state.listFields[listId].offset = 0;
            }
        }
    }

    /**
     * @param {string} graphId
     * @param {string} fieldName
     */
    selectedGraphField(graphId, fieldName) {
        if (!fieldName) {
            delete this.state.graphFields[graphId];
            return;
        }
        const field = this.getters.getGraphDataSource(graphId).getField(fieldName);
        if (field) {
            this.state.graphFields[graphId] = {
                field: fieldName,
                type: field.type,
            };
            if (this.state.type === "date") {
                this.state.graphFields[graphId].offset = 0;
            }
        }
    }

    getModelField(field) {
        if (!field || !field.field || !field.type) {
            return undefined;
        }
        return {
            field: field.field,
            type: field.type,
        };
    }

    onSetPivotFieldOffset(id, offset) {
        this.state.pivotFields[id].offset = parseInt(offset);
    }

    onSetListFieldOffset(id, offset) {
        this.state.listFields[id].offset = parseInt(offset);
    }

    onSetGraphFieldOffset(id, offset) {
        this.state.graphFields[id].offset = parseInt(offset);
    }

    onSave() {
        this.state.saved = true;
        if (this.missingLabel || this.missingModel) {
            this.notification.add(this.env._t("Some required fields are not valid"), {
                type: "danger",
                sticky: false,
            });
            return;
        }
        const cmd = this.id ? "EDIT_GLOBAL_FILTER" : "ADD_GLOBAL_FILTER";
        const id = this.id || uuidGenerator.uuidv4();
        const filter = {
            id,
            type: this.state.type,
            label: this.state.label,
            modelName: this.state.relation.relatedModel.technical,
            defaultValue: this.state[this.state.type].defaultValue,
            defaultValueDisplayNames: this.state[this.state.type].displayNames,
            rangeType: this.state.date.type,
            defaultsToCurrentPeriod: this.state.date.defaultsToCurrentPeriod,
            pivotFields: this.state.pivotFields,
            listFields: this.state.listFields,
            graphFields: this.state.graphFields,
        };
        const result = this.env.model.dispatch(cmd, { id, filter });
        if (result.isCancelledBecause(CommandResult.DuplicatedFilterLabel)) {
            this.notification.add(this.env._t("Duplicated Label"), {
                type: "danger",
                sticky: false,
            });
            return;
        }
        this.env.openSidePanel("GLOBAL_FILTERS_SIDE_PANEL", {});
    }

    onCancel() {
        this.env.openSidePanel("GLOBAL_FILTERS_SIDE_PANEL", {});
    }

    onValuesSelected(value) {
        this.state.relation.defaultValue = value.map((record) => record.id);
        this.state.relation.displayNames = value.map((record) => record.display_name);
    }

    onTimeRangeChanged(defaultValue) {
        this.state.date.defaultValue = defaultValue;
    }

    onDelete() {
        if (this.id) {
            this.env.model.dispatch("REMOVE_GLOBAL_FILTER", { id: this.id });
        }
        this.env.openSidePanel("GLOBAL_FILTERS_SIDE_PANEL", {});
    }

    onDateOptionChange(ev) {
        // TODO t-model does not work ?
        this.state.date.type = ev.target.value;
        this.state.date.defaultValue = {};
    }

    toggleDefaultsToCurrentPeriod(ev) {
        this.state.date.defaultsToCurrentPeriod = ev.target.checked;
    }
}
FilterEditorSidePanel.template = "spreadsheet_edition.FilterEditorSidePanel";
FilterEditorSidePanel.components = {
    FieldSelectorAdapter,
    ModelSelector,
    RecordsSelector,
    DateFilterValue,
    FilterFieldOffset,
};
