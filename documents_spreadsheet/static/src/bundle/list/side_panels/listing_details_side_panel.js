/** @odoo-module */

import { Domain } from "@web/core/domain";
import { DomainSelector } from "@web/core/domain_selector/domain_selector";
import { _t } from "web.core";
import { time_to_str } from "web.time";

import EditableName from "../../o_spreadsheet/editable_name/editable_name";

const { Component, onWillStart } = owl;

export class ListingDetailsSidePanel extends Component {
    constructor() {
        super(...arguments);
        this.getters = this.env.model.getters;
        onWillStart(async () => {
            const name = await this.getters
                .getSpreadsheetListDataSource(this.props.listId)
                .getModelLabel();
            this.modelDisplayName = name;
        });
    }

    get listDefinition() {
        const listId = this.props.listId;
        const def = this.getters.getListDefinition(listId);
        return {
            model: def.model,
            modelDisplayName: this.modelDisplayName,
            domain: new Domain(def.domain).toString(),
            orderBy: def.orderBy,
        };
    }

    formatSort(sort) {
        return `${this.getters
            .getSpreadsheetListModel(this.props.listId)
            .getListHeaderValue(sort.name)} (${sort.asc ? _t("ascending") : _t("descending")})`;
    }

    getLastUpdate() {
        const lastUpdate = this.getters.getSpreadsheetListDataSource(this.props.listId).lastUpdate;
        if (lastUpdate) {
            return time_to_str(new Date(lastUpdate));
        }
        return _t("never");
    }

    onNameChanged(name) {
        this.env.model.dispatch("RENAME_ODOO_LIST", {
            listId: this.props.listId,
            name,
        });
    }

    async refresh() {
        this.env.model.dispatch("REFRESH_ODOO_LIST", { listId: this.props.listId });
        this.env.model.dispatch("EVALUATE_CELLS", { sheetId: this.getters.getActiveSheetId() });
    }
}
ListingDetailsSidePanel.template = "documents_spreadsheet.ListingDetailsSidePanel";
ListingDetailsSidePanel.components = { DomainSelector, EditableName };
ListingDetailsSidePanel.props = {
    listId: {
        type: String,
        optional: true,
    },
};
