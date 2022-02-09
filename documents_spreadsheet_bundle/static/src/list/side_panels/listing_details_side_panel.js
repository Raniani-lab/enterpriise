/** @odoo-module */

import DomainSelector from "web.DomainSelector";
import { _t } from "web.core";
import { time_to_str } from "web.time";

import DomainComponentAdapter from "../../legacy/domain_component_adapter";

const { Component } = owl;

export class ListingDetailsSidePanel extends Component {
    constructor() {
        super(...arguments);
        this.getters = this.env.model.getters;
        this.DomainSelector = DomainSelector;
    }

    get listDefinition() {
        const listId = this.props.listId;
        return {
            model: this.getters.getListModel(listId),
            modelDisplayName: this.getters.getListModelDisplayName(listId),
            domain: this.getters.getListDomain(listId),
            orderBy: this.getters.getListOrderBy(listId),
        };
    }

    formatSort(sort) {
        return `${this.getters.getListFieldName(this.props.listId, sort.name)} (${
            sort.asc ? _t("ascending") : _t("descending")
        })`;
    }

    getLastUpdate() {
        const lastUpdate = this.getters.getListLastUpdate(this.props.listId);
        if (lastUpdate) {
            return time_to_str(new Date(lastUpdate));
        }
        return _t("never");
    }

    async refresh() {
        this.env.model.dispatch("REFRESH_ODOO_LIST", { listId: this.props.listId });
        this.env.model.dispatch("EVALUATE_CELLS", { sheetId: this.getters.getActiveSheetId() });
    }
}
ListingDetailsSidePanel.template = "documents_spreadsheet.ListingDetailsSidePanel";
ListingDetailsSidePanel.components = { DomainComponentAdapter };
ListingDetailsSidePanel.props = {
    listId: {
        type: String,
        optional: true,
    },
};
