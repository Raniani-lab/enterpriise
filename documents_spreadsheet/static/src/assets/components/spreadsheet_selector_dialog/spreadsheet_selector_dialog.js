/** @odoo-module */

import { _t } from "@web/core/l10n/translation";
import { Dialog } from "@web/core/dialog/dialog";
import { sprintf } from "@web/core/utils/strings";
import { useService } from "@web/core/utils/hooks";
import { SearchBar } from "@web/search/search_bar/search_bar";
import { Pager } from "@web/core/pager/pager";

const { Component, onWillStart, useState } = owl;

const LABELS = {
    PIVOT: "pivot",
    LIST: "list",
    LINK: "link",
};

const DEFAULT_LIMIT = 9;

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
            spreadsheets: {},
            panel: "spreadsheets",
            selectedSpreadsheetId: false,
            threshold: this.props.threshold,
            name: this.props.name,
            pagerProps: {
                offset: 0,
                limit: DEFAULT_LIMIT,
                total: 0,
            },
        });
        this.orm = useService("orm");
        this.currentSearch = "";

        onWillStart(async () => {
            await this._fetchSpreadsheets();
            this.state.pagerProps.total = await this.orm.call(
                "documents.document",
                "search_count",
                [[["handler", "=", "spreadsheet"]]],
            );
        });
    }

    onSearchInput(ev) {
        this.currentSearch = ev.target.value;
        this._fetchSpreadsheets();
    }

    /**
     * @param {Object} param0
     * @param {number} param0.offset
     * @param {number} param0.limit
     */
    onUpdatePager({ offset, limit }) {
        this.state.pagerProps.offset = offset;
        this.state.pagerProps.limit = limit;
        this._fetchSpreadsheets();
    }

    /**
     * @param {string} panel "spreadsheets" | "dashboards"
     */
    activatePanel(panel) {
        this.state.panel = panel;
    }

    /**
     * @param {string} [base64]
     * @returns {string}
     */
    getUrl(base64) {
        return base64 ? `data:image/jpeg;charset=utf-8;base64,${base64}` : "";
    }

    get nameLabel() {
        return sprintf(_t("Name of the %s:"), LABELS[this.props.type]);
    }

    get title() {
        return sprintf(_t("Select a spreadsheet to insert your %s."), LABELS[this.props.type]);
    }

    /**
     * Fetch spreadsheets according to the search domain and the pager
     * offset given as parameter.
     * @private
     * @returns {Promise<void>}
     */
    async _fetchSpreadsheets() {
        const domain = [];
        if (this.currentSearch !== "") {
            domain.push(["name", "ilike", this.currentSearch]);
        }
        const { offset, limit } = this.state.pagerProps;

        this.state.spreadsheets = await this.orm.call(
            "documents.document",
            "get_spreadsheets_to_display",
            [domain],
            { offset, limit }
        );
    }

    /**
     * @param {number|false} id
     */
    _selectItem(id) {
        this.state.selectedSpreadsheetId = id;
    }

    _confirm() {
        const threshold = this.state.threshold ? parseInt(this.state.threshold, 10) : 0;
        const spreadsheet =
            this.state.selectedSpreadsheetId &&
            this.state.spreadsheets.find((s) => s.id === this.state.selectedSpreadsheetId);
        this.props.confirm({
            spreadsheet,
            name: this.state.name,
            threshold,
        });
        this.props.close();
    }

    _cancel() {
        this.props.close();
    }
}

SpreadsheetSelectorDialog.template = "documents_spreadsheet.SpreadsheetSelectorDialog";
SpreadsheetSelectorDialog.components = { Dialog, SearchBar, Pager };
SpreadsheetSelectorDialog.props = {
    type: String,
    threshold: { type: Number, optional: true },
    maxThreshold: { type: Number, optional: true },
    name: String,
    confirm: Function,
    close: Function,
};
