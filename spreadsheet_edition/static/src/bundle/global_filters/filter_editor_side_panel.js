/** @odoo-module */

import { _t, _lt } from "@web/core/l10n/translation";
import spreadsheet from "@spreadsheet/o_spreadsheet/o_spreadsheet_extended";
import DateFilterValue from "@spreadsheet_edition/assets/components/filter_date_value";
import CommandResult from "@spreadsheet/o_spreadsheet/cancelled_reason";
import {
    FieldSelectorWidget,
    FieldSelectorAdapter,
} from "spreadsheet_edition.field_selector_widget";
import { X2ManyTagSelector } from "@spreadsheet_edition/assets/widgets/tag_selector_widget";
import { useService } from "@web/core/utils/hooks";
import { LegacyComponent } from "@web/legacy/legacy_component";
import { ModelSelector } from "@spreadsheet_edition/assets/components/model_selector/model_selector";
import { sprintf } from "@web/core/utils/strings";

const { onMounted, onWillStart, useState } = owl;
const uuidGenerator = new spreadsheet.helpers.UuidGenerator();

const RANGE_TYPES = [
    { type: "year", description: _lt("Year") },
    { type: "quarter", description: _lt("Quarter") },
    { type: "month", description: _lt("Month") },
];

/**
 * @typedef {import("@spreadsheet/data_sources/data_source").Field} Field
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
                type: "year", // "year" | "month" | "quarter"
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
        this.modelDisplayNames = {
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

    get missingPivotField() {
        return this.state.saved && Object.keys(this.state.pivotFields).length === 0;
    }

    get missingListField() {
        return this.state.saved && Object.keys(this.state.listFields).length === 0;
    }

    get missingGraphField() {
        return this.state.saved && Object.keys(this.state.graphFields).length === 0;
    }

    get missingModel() {
        return (
            this.state.saved &&
            this.state.type === "relation" &&
            !this.state.relation.relatedModel.technical
        );
    }

    get dateRangeTypes() {
        return RANGE_TYPES;
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
            Object.values(this.getters.getSpreadsheetPivotModel(pivotId).getFields())
        );
        const lists = this.listIds.map((listId) =>
            Object.values(this.getters.getSpreadsheetListModel(listId).getFields())
        );
        const graphs = this.graphIds.map((graphId) =>
            Object.values(this.getters.getSpreadsheetGraphDataSource(graphId).getFields())
        );
        const all = pivots.concat(lists).concat(graphs);
        return [
            ...new Set(
                all
                    .flat()
                    .filter((field) => field.type === "many2one")
                    .map((field) => field.relation)
            ),
        ];
    }

    loadValues() {
        this.id = this.props.id;
        const globalFilter = this.id && this.getters.getGlobalFilter(this.id);
        if (globalFilter) {
            this.state.label = globalFilter.label;
            this.state.type = globalFilter.type;
            this.state.pivotFields = globalFilter.pivotFields;
            this.state.listFields = globalFilter.listFields;
            this.state.graphFields = globalFilter.graphFields;
            this.state.date.type = globalFilter.rangeType;
            this.state.date.defaultsToCurrentPeriod = globalFilter.defaultsToCurrentPeriod;
            this.state[this.state.type].defaultValue = globalFilter.defaultValue;
            if (this.state.type === "relation") {
                this.state.relation.relatedModel.technical = globalFilter.modelName;
            }
        }
    }

    async onWillStart() {
        const proms = [];
        proms.push(this.fetchModelFromName());
        for (const pivotId of this.getters.getPivotIds()) {
            const dataSource = this.getters.getSpreadsheetPivotDataSource(pivotId);
            proms.push(dataSource.loadModel());
            proms.push(
                dataSource
                    .getModelLabel()
                    .then((name) => (this.modelDisplayNames.pivots[pivotId] = name))
            );
        }
        for (const listId of this.listIds) {
            const dataSource = this.getters.getSpreadsheetListDataSource(listId);
            proms.push(dataSource.loadModel());
            proms.push(
                dataSource
                    .getModelLabel()
                    .then((name) => (this.modelDisplayNames.lists[listId] = name))
            );
        }
        for (const graphId of this.graphIds) {
            const dataSource = this.getters.getSpreadsheetGraphDataSource(graphId);
            proms.push(dataSource.loadModel());
            proms.push(
                dataSource
                    .getModelLabel()
                    .then((name) => (this.modelDisplayNames.graph[graphId] = name))
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
     * @param {{Object.<string, Field>}} fields Fields to look in
     * @returns {Array<string, Field>|undefined}
     */
    _findRelation(fields) {
        return (
            Object.entries(fields).find(
                ([, fieldDesc]) =>
                    fieldDesc.type === "many2one" &&
                    fieldDesc.relation === this.state.relation.relatedModel.technical
            ) || []
        );
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
            const [field, fieldDesc] = this._findRelation(
                this.getters.getSpreadsheetPivotModel(pivotId).getFields()
            );
            this.state.pivotFields[pivotId] = field ? { field, type: fieldDesc.type } : undefined;
        }
        for (const listId of this.listIds) {
            const [field, fieldDesc] = this._findRelation(
                this.getters.getSpreadsheetListModel(listId).getFields()
            );
            this.state.listFields[listId] = field ? { field, type: fieldDesc.type } : undefined;
        }
        for (const graphId of this.graphIds) {
            const [field, fieldDesc] = this._findRelation(
                this.getters.getSpreadsheetGraphModel(graphId).metaData.fields
            );
            this.state.graphFields[graphId] = field ? { field, type: fieldDesc.type } : undefined;
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

    onSelectedPivotField(id, chain) {
        const fieldName = chain[0];
        const field = this.getters.getSpreadsheetPivotModel(id, fieldName).getField(fieldName);
        if (field) {
            this.state.pivotFields[id] = {
                field: fieldName,
                type: field.type,
            };
        }
    }

    onSelectedListField(listId, chain) {
        const fieldName = chain[0];
        const field = this.getters.getSpreadsheetListModel(listId).getField(fieldName);
        if (field) {
            this.state.listFields[listId] = {
                field: fieldName,
                type: field.type,
            };
        }
    }

    onSelectedGraphField(graphId, chain) {
        const fieldName = chain[0];
        const field = this.getters.getSpreadsheetGraphModel(graphId).metaData.fields[fieldName];
        if (field) {
            this.state.graphFields[graphId] = {
                field: fieldName,
                type: field.type,
            };
        }
    }

    onSave() {
        this.state.saved = true;
        const missingField =
            (this.listIds.length !== 0 && this.missingListField) ||
            (this.pivotIds.length !== 0 && this.missingPivotField) ||
            (this.graphIds.length !== 0 && this.missingGraphField);
        if (this.missingLabel || missingField || this.missingModel) {
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
    X2ManyTagSelector,
    DateFilterValue,
};
