/** @odoo-module */

import { _t } from "@web/core/l10n/translation";
import { Dialog } from "@web/core/dialog/dialog";
import { sprintf } from "@web/core/utils/strings";
import { useService } from "@web/core/utils/hooks";

const { Component, useState } = owl;

const LABELS = {
    PIVOT: "pivot",
    LIST: "list",
    LINK: "link",
    GRAPH: "graph",
};

/**
 * @typedef State
 * @property {Object} spreadsheets
 * @property {string} panel
 * @property {string} name
 * @property {number|false} selectedSpreadsheetId
 * @property {string} [threshold]
 * @property {Object} pagerProps
 * @property {number} pagerProps.offset
 * @property {number} pagerProps.limit
 * @property {number} pagerProps.total
 */

export class SpreadsheetSelectorDialog extends Component {
    setup() {
        /** @type {State} */
        this.state = useState({
            panel: "spreadsheets",
            threshold: this.props.threshold,
            name: this.props.name,
        });
        this.actionState = {
            actionTag: undefined,
            selectedSpreadsheet: false,
            notificationMessage: "",
        };
        this.notification = useService("notification");
        this.actionService = useService("action");
    }

    /**
     * @param {string} panel "spreadsheets" | "dashboards"
     */
    activatePanel(panel) {
        this.state.panel = panel;
    }

    get nameLabel() {
        return sprintf(_t("Name of the %s:"), LABELS[this.props.type]);
    }

    get title() {
        return sprintf(_t("Select a spreadsheet to insert your %s."), LABELS[this.props.type]);
    }

    /**
     * @param {number|false} id
     */
    onSpreadsheetSelected({ spreadsheet, actionTag, notificationMessage }) {
        this.actionState = {
            selectedSpreadsheet: spreadsheet,
            actionTag,
            notificationMessage,
        };
    }

    _confirm() {
        const threshold = this.state.threshold ? parseInt(this.state.threshold, 10) : 0;
        const isNewItem = this.actionState.selectedSpreadsheet === false;
        const notificationMessage = isNewItem
            ? this.actionState.notificationMessage
            : sprintf(_t("New sheet inserted in '%s'"), this.actionState.selectedSpreadsheet.name);
        const actionOptions = {
            ...this.props.actionOptions,
            preProcessingAsyncActionData: {
                ...this.props.actionOptions.preProcessingAsyncActionData,
                threshold,
                name: this.state.name,
            },
            preProcessingActionData: {
                ...this.props.actionOptions.preProcessingActionData,
                threshold,
                name: this.state.name,
            },
            alwaysCreate: isNewItem,
            spreadsheet_id:
                this.actionState.selectedSpreadsheet && this.actionState.selectedSpreadsheet.id,
        };

        this.notification.add(notificationMessage, { type: "info" });
        this.actionService.doAction({
            type: "ir.actions.client",
            tag: this.actionState.actionTag,
            params: actionOptions,
        });
        this.props.close();
    }

    _cancel() {
        this.props.close();
    }
}

SpreadsheetSelectorDialog.template = "spreadsheet_edition.SpreadsheetSelectorDialog";
SpreadsheetSelectorDialog.components = { Dialog };
SpreadsheetSelectorDialog.props = {
    actionOptions: Object,
    type: String,
    threshold: { type: Number, optional: true },
    maxThreshold: { type: Number, optional: true },
    name: String,
    close: Function,
};
