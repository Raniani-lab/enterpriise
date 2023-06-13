/** @odoo-module */

import { browser } from "@web/core/browser/browser";
import { session } from "@web/session";
import { useService } from "@web/core/utils/hooks";

import { AccountReportFootnoteDialog } from "@account_reports/components/account_report/footnote/dialog/footnote_dialog";

export class AccountReportController {
    constructor(action) {
        this.action = action;
        this.actionService = useService("action");
        this.dialog = useService("dialog");
        this.orm = useService("orm");
    }

    async load(previousOptions = null) {
        // If there are no previous options and there is options saved in session, we want to use them by default
        const reportOptions = previousOptions || ((this.hasSessionOptions()) ? this.sessionOptions() : false);
        const reportID = (previousOptions) ? previousOptions.report_id : this.action.context.report_id;

        this.data = await this.orm.call(
            "account.report",
            "get_report_information",
            [
                reportID,
                reportOptions,
            ],
            {
                context: this.action.context,
            },
        );

        // If there is a specific order for lines in the options, we want to use it by default
        if (this.areLinesOrdered())
            await this.sortLines();

        this.assignLinesVisibility(this.lines);
        this.refreshVisibleFootnotes();
        this.saveSessionOptions();
    }

    //------------------------------------------------------------------------------------------------------------------
    // Generic data getters
    //------------------------------------------------------------------------------------------------------------------
    get buttons() {
        return this.data.options.buttons;
    }

    get caretOptions() {
        return this.data.caret_options;
    }

    get columnHeadersRenderData() {
        return this.data.column_headers_render_data;
    }

    get columnGroupsTotals() {
        return this.data.column_groups_totals;
    }

    get context() {
        return this.data.context;
    }

    get filters() {
        return this.data.filters;
    }

    get footnotes() {
        return this.data.footnotes;
    }

    get groups() {
        return this.data.groups;
    }

    get options() {
        return this.data.options;
    }

    get lines() {
        return this.data.lines;
    }

    get linesOrder() {
        return this.data.lines_order;
    }

    get report() {
        return this.data.report;
    }

    get visibleFootnotes() {
        return this.data.visible_footnotes;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Generic data setters
    //------------------------------------------------------------------------------------------------------------------
    set footnotes(value) {
        this.data.footnotes = value;
    }

    set columnGroupsTotals(value) {
        this.data.column_groups_totals = value;
    }

    set lines(value) {
        this.data.lines = value;
        this.assignLinesVisibility(this.lines);
    }

    set linesOrder(value) {
        this.data.lines_order = value;
    }

    set options(value) {
        this.data.options = value;
    }

    set visibleFootnotes(value) {
        this.data.visible_footnotes = value;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Helpers
    //------------------------------------------------------------------------------------------------------------------
    get hasComparisonColumn() {
        return Boolean(this.options.show_growth_comparison);
    }

    get hasCustomSubheaders() {
        return this.columnHeadersRenderData.custom_subheaders.length > 0;
    }

    get hasDebugColumn() {
        return Boolean(this.options.show_debug_column);
    }

    get hasStringDate() {
        return "date" in this.options && "string" in this.options.date;
    }

    get hasVisibleFootnotes() {
        return this.visibleFootnotes.length > 0;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Options
    //------------------------------------------------------------------------------------------------------------------
    async _updateOption(operationType, optionPath, optionValue=null, reloadUI=false) {
        const optionKeys = optionPath.split(".");

        let currentOptionKey = null;
        let option = this.options;

        while (optionKeys.length > 1) {
            currentOptionKey = optionKeys.shift();
            option = option[currentOptionKey];

            if (option  === undefined)
                throw new Error(`Invalid option key in _updateOption(): ${ currentOptionKey } (${ optionPath })`);
        }

        switch (operationType) {
            case "update":
                option[optionKeys[0]] = optionValue;
                break;
            case "delete":
                delete option[optionKeys[0]];
                break;
            case "toggle":
                option[optionKeys[0]] = !option[optionKeys[0]];
                break;
            default:
                throw new Error(`Invalid operation type in _updateOption(): ${ operationType }`);
        }

        if (reloadUI)
            await this.load(this.options);
    }

    async updateOption(optionPath, optionValue, reloadUI=false) {
        await this._updateOption('update', optionPath, optionValue, reloadUI);
    }

    async deleteOption(optionPath, reloadUI=false) {
        await this._updateOption('delete', optionPath, null, reloadUI);
    }

    async toggleOption(optionPath, reloadUI=false) {
        await this._updateOption('toggle', optionPath, null, reloadUI);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Session options
    //------------------------------------------------------------------------------------------------------------------
    sessionOptionsID() {
        return `account.report:${ this.action.context.report_id }:${ session.company_id }`;
    }

    useSessionOptions() {
        const ignoreSession = this.action.params && this.action.params.ignore_session;

        return ignoreSession !== "write" && ignoreSession !== "both";
    }

    hasSessionOptions() {
        return (this.useSessionOptions()) ? Boolean(browser.sessionStorage.getItem(this.sessionOptionsID())) : false;
    }

    saveSessionOptions() {
        if (this.useSessionOptions())
            browser.sessionStorage.setItem(this.sessionOptionsID(), JSON.stringify(this.options));
    }

    sessionOptions() {
        return JSON.parse(browser.sessionStorage.getItem(this.sessionOptionsID()));
    }

    //------------------------------------------------------------------------------------------------------------------
    // Lines
    //------------------------------------------------------------------------------------------------------------------
    lineHasDebugData(lineIndex) {
        return 'debug_popup_data' in this.lines[lineIndex];
    }

    lineHasComparisonData(lineIndex) {
        return Boolean(this.lines[lineIndex].growth_comparison_data);
    }

    isNextLineChild(index, lineId) {
        return index < this.lines.length && this.lines[index].id.startsWith(lineId);
    }

    isNextLineDirectChild(index, lineId) {
        return index < this.lines.length && this.lines[index].parent_id === lineId;
    }

    isTotalLine(lineIndex) {
        return this.lines[lineIndex].id.includes("|total~~");
    }

    isLoadMoreLine(lineIndex) {
        return this.lines[lineIndex].id.includes("|load_more~~");
    }

    isLoadedLine(lineIndex) {
        const lineID = this.lines[lineIndex].id;
        const nextLineIndex = lineIndex + 1;

        return this.isNextLineChild(nextLineIndex, lineID) && !this.isTotalLine(nextLineIndex) && !this.isLoadMoreLine(nextLineIndex);
    }

    async replaceLineWith(replaceIndex, newLines) {
        await this.insertLines(replaceIndex, 1, newLines);
    }

    async insertLinesAfter(insertIndex, newLines) {
        await this.insertLines(insertIndex + 1, 0, newLines);
    }

    async insertLines(lineIndex, deleteCount, newLines) {
        this.lines.splice(lineIndex, deleteCount, ...newLines);

        if (this.areLinesOrdered())
            await this.sortLines();
    }

    //------------------------------------------------------------------------------------------------------------------
    // Unfolded/Folded lines
    //------------------------------------------------------------------------------------------------------------------
    unfoldLoadedLine(lineIndex) {
        const lineId = this.lines[lineIndex].id;
        let nextLineIndex = lineIndex + 1;

        while (this.isNextLineChild(nextLineIndex, lineId)) {
            if (this.isNextLineDirectChild(nextLineIndex, lineId))
                this.lines[nextLineIndex].visible = true;

            nextLineIndex += 1;
        }
    }

    async unfoldNewLine(lineIndex) {
        const newLines = await this.orm.call(
            "account.report",
            "get_expanded_lines",
            [
                this.options.report_id,
                this.options,
                this.lines[lineIndex].id,
                this.lines[lineIndex].groupby,
                this.lines[lineIndex].expand_function,
                this.lines[lineIndex].progress,
                0,
            ],
        );

        this.assignLinesVisibility(newLines);
        this.insertLinesAfter(lineIndex, newLines);

        if (this.filters.show_totals)
            this.lines[lineIndex + newLines.length + 1].visible = true;
    }

    async unfoldLine(lineIndex) {
        const targetLine = this.lines[lineIndex];

        if (this.isLoadedLine(lineIndex))
            this.unfoldLoadedLine(lineIndex);
        else
            await this.unfoldNewLine(lineIndex);

        targetLine.unfolded = true;

        this.refreshVisibleFootnotes();

        // Update options
        if (!this.options.unfolded_lines.includes(targetLine.id))
            this.options.unfolded_lines.push(targetLine.id)

        this.saveSessionOptions();
    }

    foldLine(lineIndex) {
        const targetLine = this.lines[lineIndex];

        let foldedLinesIDs = new Set([targetLine.id]);
        let nextLineIndex = lineIndex + 1;

        while (this.isNextLineChild(nextLineIndex, targetLine.id)) {
            this.lines[nextLineIndex].unfolded = false;
            this.lines[nextLineIndex].visible = false;

            foldedLinesIDs.add(this.lines[nextLineIndex].id);

            nextLineIndex += 1;
        }

        targetLine.unfolded = false;

        this.refreshVisibleFootnotes();

        // Update options
        this.options.unfolded_lines = this.options.unfolded_lines.filter(
            unfoldedLineID => !foldedLinesIDs.has(unfoldedLineID)
        );

        this.saveSessionOptions();
    }

    //------------------------------------------------------------------------------------------------------------------
    // Ordered lines
    //------------------------------------------------------------------------------------------------------------------
    linesCurrentOrderByColumn(columnIndex) {
        if (this.areLinesOrderedByColumn(columnIndex))
            return this.options.order_column.direction;

        return "default";
    }

    areLinesOrdered() {
        return this.linesOrder != null && this.options.order_column != null;
    }

    areLinesOrderedByColumn(columnIndex) {
        return this.areLinesOrdered() && this.options.order_column.expression_label === this.options.columns[columnIndex].expression_label;
    }

    async sortLinesByColumnAsc(columnIndex) {
        this.options.order_column = {
            expression_label: this.options.columns[columnIndex].expression_label,
            direction: "ASC",
        };

        await this.sortLines();
        this.saveSessionOptions();
    }

    async sortLinesByColumnDesc(columnIndex) {
        this.options.order_column = {
            expression_label: this.options.columns[columnIndex].expression_label,
            direction: "DESC",
        };

        await this.sortLines();
        this.saveSessionOptions();
    }

    sortLinesByDefault() {
        delete this.options.order_column;
        delete this.linesOrder;

        this.saveSessionOptions();
    }

    async sortLines() {
        this.linesOrder = await this.orm.call(
            "account.report",
            "sort_lines",
            [
                this.lines,
                this.options,
                true,
            ],
            {
                context: this.action.context,
            },
        );
    }

    //------------------------------------------------------------------------------------------------------------------
    // Footnotes
    //------------------------------------------------------------------------------------------------------------------
    async refreshFootnotes() {
        this.footnotes = await this.orm.call(
            "account.report",
            "get_footnotes",
            [
                this.action.context.report_id,
                this.options,
            ],
        );

        this.refreshVisibleFootnotes();
    }

    async addFootnote(lineID) {
        this.dialog.add(AccountReportFootnoteDialog, {
            lineID: lineID,
            reportID: this.options.report_id,
            footnoteID: this.footnotes[lineID] ? this.footnotes[lineID].id : null,
            context: this.context,
            text: this.footnotes[lineID] ? this.footnotes[lineID].text : "",
            refresh: this.refreshFootnotes.bind(this),
        });
    }

    async deleteFootnote(footnote) {
        await this.orm.call(
            "account.report.footnote",
            "unlink",
            [
                footnote.id,
            ],
            {
                context: this.context,
            },
        );

        await this.refreshFootnotes();
    }

    //------------------------------------------------------------------------------------------------------------------
    // Visibility
    //------------------------------------------------------------------------------------------------------------------
    refreshVisibleFootnotes() {
        let visibleFootnotes = [];

        this.lines.forEach(line => {
            if (this.footnotes[line.id] && line.visible) {
                const number = visibleFootnotes.length + 1;

                visibleFootnotes.push({
                    ...this.footnotes[line.id],
                    "href": `footnote_${number}`,
                });

                line["visible_footnote"] = {
                    "number": number,
                    "href": `#footnote_${number}`,
                };
            }

            if (line.visible_footnote && (!this.footnotes[line.id] || !line.visible))
                delete line.visible_footnote;
        });

        this.visibleFootnotes = visibleFootnotes;
    }

    /**
        Defines which lines should be visible in the provided list of lines (depending on what is folded).
    **/
    assignLinesVisibility(linesToAssign) {
        let needHidingChildren = new Set();

        linesToAssign.forEach((line) => {
            line.visible = !needHidingChildren.has(line.parent_id);

            if (!line.visible || (line.unfoldable &! line.unfolded))
                needHidingChildren.add(line.id);
        });
    }

    //------------------------------------------------------------------------------------------------------------------
    // Server calls
    //------------------------------------------------------------------------------------------------------------------
    async reportAction(ev, action, actionParam = null) {
        ev.preventDefault();
        ev.stopPropagation();

        const dispatchReportAction = await this.orm.call(
            "account.report",
            "dispatch_report_action",
            [
                this.options.report_id,
                this.options,
                action,
                actionParam,
            ],
        );

        return dispatchReportAction ? this.actionService.doAction(dispatchReportAction) : null;
    }
}
