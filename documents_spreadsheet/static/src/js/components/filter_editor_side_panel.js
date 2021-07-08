/* global _ */

odoo.define("documents_spreadsheet.filter_editor_side_panel", function (require) {
    "use strict";

    const core = require("web.core");
    const spreadsheet = require("documents_spreadsheet.spreadsheet_extended");
    const DateFilterValue = require("documents_spreadsheet.DateFilterValue");
    const CommandResult = require("documents_spreadsheet.CommandResult");
    const {
        FieldSelectorWidget,
        FieldSelectorAdapter,
    } = require("documents_spreadsheet.field_selector_widget");
    const {
        ModelSelectorWidget,
        ModelSelectorWidgetAdapter,
    } = require("documents_spreadsheet.model_selector_widget");
    const {
        TagSelectorWidget,
        TagSelectorWidgetAdapter,
    } = require("documents_spreadsheet.tag_selector_widget");
    const { useService } = require("@web/core/utils/hooks");
    const _t = core._t;
    const { useState } = owl.hooks;
    const sidePanelRegistry = spreadsheet.registries.sidePanelRegistry;
    const uuidGenerator = new spreadsheet.helpers.UuidGenerator();

    /**
     * This is the side panel to define/edit a global filter.
     * It can be of 3 different type: text, date and relation.
     */
    class FilterEditorSidePanel extends owl.Component {
        /**
         * @constructor
         */
        constructor(parent, props) {
            super(...arguments);
            this.id = undefined;
            this.state = useState({
                saved: false,
                label: undefined,
                type: undefined,
                pivotFields: {},
                text: {
                    defaultValue: undefined,
                },
                date: {
                    defaultValue: {},
                    type: undefined, // "year" | "month" | "quarter"
                    options: [],
                },
                relation: {
                    defaultValue: [],
                    displayNames: [],
                    relatedModelID: undefined,
                    relatedModelName: undefined,
                },
            });
            this.getters = this.env.getters;
            this.pivotIds = this.getters.getPivotIds();
            this.loadValues(props);
            // Widgets
            this.FieldSelectorWidget = FieldSelectorWidget;
            this.ModelSelectorWidget = ModelSelectorWidget;
            this.TagSelectorWidget = TagSelectorWidget;
            this.orm = useService("orm");
            this.notification = useService("notification");
        }

        /**
         * Retrieve the placeholder of the label
         */
        get placeholder() {
            return _.str.sprintf(_t("New %s filter"), this.state.type);
        }

        get missingLabel() {
            return this.state.saved && !this.state.label;
        }

        get missingField() {
            return this.state.saved && Object.keys(this.state.pivotFields).length === 0;
        }

        get missingModel() {
            return (
                this.state.saved &&
                this.state.type === "relation" &&
                !this.state.relation.relatedModelID
            );
        }

        loadValues(props) {
            this.id = props.id;
            const globalFilter = this.id && this.getters.getGlobalFilter(this.id);
            this.state.label = globalFilter && globalFilter.label;
            this.state.type = globalFilter ? globalFilter.type : props.type;
            this.state.pivotFields = globalFilter ? globalFilter.fields : {};
            this.state.date.type =
                this.state.type === "date" && globalFilter ? globalFilter.rangeType : "year";
            if (globalFilter) {
                this.state[this.state.type].defaultValue = globalFilter.defaultValue;
                if (this.state.type === "relation") {
                    this.state.relation.relatedModelName = globalFilter.modelName;
                }
            }
        }

        async willStart() {
            const proms = [];
            proms.push(this.fetchModelFromName());
            for (const pivotId of this.getters.getPivotIds()) {
                proms.push(this.getters.waitForPivotMetaData(pivotId));
            }
            await Promise.all(proms);
        }

        async onModelSelected(ev) {
            if (this.state.relation.relatedModelID !== ev.detail.value) {
                this.state.relation.defaultValue = [];
            }
            this.state.relation.relatedModelID = ev.detail.value;
            await this.fetchModelFromId();
            for (const pivotId of this.pivotIds) {
                const [field, fieldDesc] =
                    Object.entries(this.getters.getPivotFields(pivotId)).find(
                        ([, fieldDesc]) =>
                            fieldDesc.type === "many2one" &&
                            fieldDesc.relation === this.state.relation.relatedModelName
                    ) || [];
                this.state.pivotFields[pivotId] = field
                    ? { field, type: fieldDesc.type }
                    : undefined;
            }
        }

        async fetchModelFromName() {
            if (!this.state.relation.relatedModelName) {
                this.state.relation.relatedModelID = undefined;
                return;
            }
            const result = await this.orm.searchRead(
                "ir.model",
                [["model", "=", this.state.relation.relatedModelName]],
                ["id", "name"]
            );
            this.state.relation.relatedModelID = result[0] && result[0].id;
            if (!this.state.label) {
                this.state.label = result[0] && result[0].name;
            }
        }

        async fetchModelFromId() {
            if (!this.state.relation.relatedModelID) {
                this.state.relation.relatedModelName = undefined;
                return;
            }
            const result = await this.orm.searchRead(
                "ir.model",
                [["id", "=", this.state.relation.relatedModelID]],
                ["model", "name"]
            );

            this.state.relation.relatedModelName = result[0] && result[0].model;
            if (!this.state.label) {
                this.state.label = result[0] && result[0].name;
            }
        }

        onSelectedField(id, ev) {
            const fieldName = ev.detail.chain[0];
            const field = this.getters.getPivotField(id, fieldName);
            if (field) {
                this.state.pivotFields[id] = {
                    field: fieldName,
                    type: field.type,
                };
            }
        }

        onSave() {
            this.state.saved = true;
            if (this.missingLabel || this.missingField || this.missingModel) {
                this.notification.add(this.env._t("Some required fields are not valid"), {
                    type: "danger",
                    sticky: false,
                });
                return;
            }
            const cmd = this.id ? "EDIT_PIVOT_FILTER" : "ADD_PIVOT_FILTER";
            const id = this.id || uuidGenerator.uuidv4();
            const filter = {
                id,
                type: this.state.type,
                label: this.state.label,
                modelName: this.state.relation.relatedModelName,
                defaultValue: this.state[this.state.type].defaultValue,
                defaultValueDisplayNames: this.state[this.state.type].displayNames,
                rangeType: this.state.date.type,
                fields: this.state.pivotFields,
            };
            const result = this.env.dispatch(cmd, { id, filter });
            if (result === CommandResult.DuplicatedFilterLabel) {
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

        onValuesSelected(ev) {
            this.state.relation.defaultValue = ev.detail.value.map((record) => record.id);
            this.state.relation.displayNames = ev.detail.value.map((record) => record.display_name);
        }

        onTimeRangeChanged(ev) {
            this.state.date.defaultValue = ev.detail;
        }

        onDelete() {
            if (this.id) {
                this.env.dispatch("REMOVE_PIVOT_FILTER", { id: this.id });
            }
            this.env.openSidePanel("GLOBAL_FILTERS_SIDE_PANEL", {});
        }

        onDateOptionChange(ev) {
            // TODO t-model does not work ?
            this.state.date.type = ev.target.value;
            this.state.date.defaultValue = {};
        }
    }
    FilterEditorSidePanel.template = "documents_spreadsheet.FilterEditorSidePanel";
    FilterEditorSidePanel.components = {
        FieldSelectorAdapter,
        ModelSelectorWidgetAdapter,
        TagSelectorWidgetAdapter,
        DateFilterValue,
    };

    sidePanelRegistry.add("FILTERS_SIDE_PANEL", {
        title: _t("Filter properties"),
        Body: FilterEditorSidePanel,
    });

    return FilterEditorSidePanel;
});
