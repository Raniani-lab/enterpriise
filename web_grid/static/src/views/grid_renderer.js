/** @odoo-module */

import { Domain } from "@web/core/domain";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { escape } from "@web/core/utils/strings";
import { useDebounced } from "@web/core/utils/timing";
import { useVirtual } from "@web/core/virtual_hook";
import { Field } from "@web/views/fields/field";
import { Record } from "@web/views/record";
import { getActiveHotkey } from "@web/core/hotkeys/hotkey_service";

import { GridComponent } from "@web_grid/components/grid_cell";

import { Component, markup, useState, onWillUpdateProps } from "@odoo/owl";

export class GridRenderer extends Component {
    static components = {
        Field,
        GridComponent,
        Record,
    };

    static template = "web_grid.Renderer";

    static props = {
        sections: { type: Array, optional: true },
        columns: { type: Array, optional: true },
        rows: { type: Array, optional: true },
        model: { type: Object, optional: true },
        options: Object,
        sectionField: { type: Object, optional: true },
        rowFields: Array,
        measureField: Object,
        isEditable: Boolean,
        widgetPerFieldName: Object,
        openAction: { type: Object, optional: true },
        contentRef: Object,
        createInline: Boolean,
        createRecord: Function,
    };

    static defaultProps = {
        sections: [],
        columns: [],
        rows: [],
        model: {},
    };

    setup() {
        this.actionService = useService("action");
        this.highlightedState = useState(this.getDefaultState(this.props.model.data));
        this.editionState = useState({
            hoveredCellInfo: false,
            editedCellInfo: false,
        });
        this.hoveredElement = null;
        this.isEditing = false;
        onWillUpdateProps(this.onWillUpdateProps);
        this.onMouseOver = useDebounced(this._onMouseOver, 10);
        this.onMouseOut = useDebounced(this._onMouseOut, 10);
        const field = this.props.model.fieldsInfo[this.props.model.measureFieldName];
        const measureFieldWidget = this.props.widgetPerFieldName[this.props.model.measureFieldName];
        const widgetName = measureFieldWidget || field.type;
        this.gridCell = registry.category("grid_components").get(widgetName);
        this.virtualRows = useVirtual({
            getItems: () => this.props.rows,
            scrollableRef: this.props.contentRef,
            initialScroll: { top: 60 },
            getItemHeight: (item) => this.getItemHeight(item),
        });
    }

    getItemHeight(item) {
        let height = this.rowHeight;
        if (item.isSection && item.isFake) {
            return 0;
        }
        if (this.props.createInline && !item.isSection && item.section.lastRow.id === item.id) {
            height *= 2; // to include the Add a line row
        }
        return height;
    }

    get isMobile() {
        return this.env.isSmall;
    }

    get rowHeight() {
        return 36;
    }

    getRowPosition(row, isCreateInlineRow = false) {
        const rowIndex = row ? this.props.rows.findIndex((r) => r.id === row.id) : 0;
        const section = row && row.getSection();
        let rowPosition = this.rowsGap + rowIndex + 1 + (section?.sectionId || 0);
        if (isCreateInlineRow) {
            rowPosition += 1;
        }
        if (!section) {
            rowPosition -= 1;
        }
        return rowPosition;
    }

    getTotalRowPosition() {
        return (
            (this.props.rows.length || 1) +
            (this.props.model.sectionField ? this.props.sections.length : 0) +
            (this.props.createInline ? 1 : 0) +
            this.rowsGap
        );
    }

    onWillUpdateProps(nextProps) {
        for (const key of Object.keys(this.highlightedState)) {
            delete this.highlightedState[key];
        }
        Object.assign(this.highlightedState, this.getDefaultState(nextProps.model.data));
    }

    formatValue(value) {
        return this.gridCell.formatter(value);
    }

    getDefaultState(data) {
        const res = {};

        for (const sectionId of Object.keys(data.sections)) {
            res[`section-${sectionId}`] = false;
        }
        for (const rowId of Object.keys(data.rows)) {
            res[`row-${rowId}`] = false;
        }
        for (const columnId of Object.keys(data.columns)) {
            res[`column-${columnId}`] = false;
        }
        res["row-total"] = false;
        return res;
    }

    get rowsCount() {
        const addLineRows = this.props.createInline ? this.props.sections.length || 1 : 0;
        return this.props.rows.length - (this.props.model.sectionField ? 0 : 1) + addLineRows;
    }

    get gridTemplateRows() {
        let totalRows = 0;
        if (!this.props.options.hideColumnTotal) {
            totalRows += 1;
            if (this.props.options.hasBarChartTotal) {
                totalRows += 1;
            }
        }
        return `auto repeat(${this.rowsCount + totalRows}, ${this.rowHeight}px)`;
    }

    get gridTemplateColumns() {
        return `auto repeat(${this.props.columns.length}, ${
            this.props.columns.length > 7 ? "minmax(5em, auto)" : "minmax(5em, 1fr)"
        }) minmax(80px, 10em)`;
    }

    get measureLabel() {
        const measureFieldName = this.props.model.measureFieldName;
        if (measureFieldName === "__count") {
            return this.env._t("Total");
        }
        return (
            this.props.measureField.string || this.props.model.fieldsInfo[measureFieldName].string
        );
    }

    get rowsGap() {
        return 1;
    }

    get columnsGap() {
        return 1;
    }

    getColumnBarChartHeightStyle(column) {
        let heightPercentage = 0;
        if (this.props.model.maxColumnsTotal !== 0) {
            heightPercentage = (column.grandTotal / this.props.model.maxColumnsTotal) * 100;
        }
        return `height: ${heightPercentage}%; bottom: 0;`;
    }

    getUnavailableClass(column, section = undefined) {
        return "";
    }

    getFieldAdditionalProps(fieldName) {
        return {
            name: fieldName,
            type: this.props.widgetPerFieldName[fieldName],
        };
    }

    onCreateInlineClick(section) {
        const context = {
            ...(section?.context || {}),
            view_grid_add_line: true,
        };
        const title = this.env._t("Add a line");
        this.props.createRecord({ context, title });
    }

    _onMouseOver(ev) {
        if (this.hoveredElement || ev.fromElement?.classList.contains("dropdown-item")) {
            // As mouseout is call prior to mouseover, if hoveredElement is set this means
            // that we haven't left it. So it's a mouseover inside it.
            return;
        }
        const highlightableElement = ev.target.closest(".o_grid_highlightable");
        if (!highlightableElement) {
            // We are not in an element that should trigger a highlight.
            return;
        }
        const stateHighlightTriggers =
            highlightableElement.dataset.stateHighlightTriggers.split(",");
        for (const stateHighlightTrigger of stateHighlightTriggers) {
            if (!this.highlightedState[stateHighlightTrigger]) {
                this.highlightedState[stateHighlightTrigger] = true;
            }
        }
        this.editionState.hoveredCellInfo = highlightableElement.dataset.stateHighlightTriggers;
        this.hoveredElement = highlightableElement;
    }

    _onMouseOut(ev) {
        if (!this.hoveredElement) {
            // If hoveredElement is not set this means were not in a o_grid_highlightable. So ignore it.
            return;
        }
        let relatedTarget = ev.relatedTarget;
        while (relatedTarget) {
            // Go up the parent chain
            if (relatedTarget === this.hoveredElement) {
                // Check that we are still inside hoveredConnector.
                // If so it means it is a transition between child elements so ignore it.
                return;
            }
            relatedTarget = relatedTarget.parentElement;
        }
        const stateHighlightTriggers =
            this.hoveredElement.dataset.stateHighlightTriggers.split(",");
        for (const stateHighlightTrigger of stateHighlightTriggers) {
            if (this.highlightedState[stateHighlightTrigger]) {
                this.highlightedState[stateHighlightTrigger] = false;
            }
        }
        this.editionState.hoveredCellInfo = false;
        this.hoveredElement = null;
    }

    onEditCell(value) {
        this.isEditing = value;
        this.editionState.editedCellInfo = value && this.editionState.hoveredCellInfo;
    }

    /**
     * Handle keydown when cell is edited in the grid view.
     *
     * @param {KeyboardEvent} ev
     * @param {import("./grid_model").GridCell} cell
     */
    onCellKeydown(ev, cell) {
        const hotkey = getActiveHotkey(ev);
        if (!["tab", "shift+tab"].includes(hotkey)) {
            if (hotkey === "escape") {
                this.editionState.editedCellInfo = false;
            }
            return;
        }
        // Purpose: prevent browser defaults
        ev.preventDefault();
        // Purpose: stop other window keydown listeners (e.g. home menu)
        ev.stopImmediatePropagation();
        let rowId = cell.row.id;
        let columnId = cell.column.id;
        const columnIds = this.props.columns.map((c) => c.id);
        const rowIds = [];
        for (const item of this.props.rows) {
            if (!item.isSection) {
                rowIds.push(item.id);
            }
        }
        let columnIndex = columnIds.indexOf(columnId);
        let rowIndex = rowIds.indexOf(rowId);
        if (hotkey === "tab") {
            columnIndex += 1;
            rowIndex += 1;
            if (columnIndex < columnIds.length) {
                columnId = columnIds[columnIndex];
            } else {
                columnId = columnIds[0];
                if (rowIndex < rowIds.length) {
                    rowId = rowIds[rowIndex];
                } else {
                    rowId = rowIds[0];
                }
            }
        } else if (hotkey === "shift+tab") {
            columnIndex -= 1;
            rowIndex -= 1;
            if (columnIndex >= 0) {
                columnId = columnIds[columnIndex];
            } else {
                columnId = columnIds[columnIds.length - 1];
                if (rowIndex >= 0) {
                    rowId = rowIds[rowIndex];
                } else {
                    rowId = rowIds[rowIds.length - 1];
                }
            }
        }
        this.editionState.editedCellInfo = `row-${rowId},column-${columnId}`;
    }

    async openRecords(actionTitle, domain, context) {
        const resModel = this.props.model.resModel;
        if (this.props.openAction) {
            const resIds = await this.props.model.orm.search(resModel, domain);
            this.actionService.doActionButton({
                ...this.props.openAction,
                resModel,
                resIds,
                context,
            });
        } else {
            const noActivitiesFound = this.env._t("No activities found");
            this.actionService.doAction({
                type: "ir.actions.act_window",
                name: actionTitle,
                res_model: resModel,
                views: [
                    [false, "list"],
                    [false, "form"],
                ],
                domain,
                context,
                help: markup(
                    `<p class='o_view_nocontent_smiling_face'>${escape(noActivitiesFound)}</p>`
                ),
            });
        }
    }

    onMagnifierGlassClick(section, column) {
        const title = `${section.title} (${column.title})`;
        const domain = Domain.and([section.domain, column.domain]).toList();
        this.openRecords(title, domain, section.context);
    }
}
