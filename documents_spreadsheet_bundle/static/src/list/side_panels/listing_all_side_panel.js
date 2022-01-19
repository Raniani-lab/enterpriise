/** @odoo-module */

import { ListingDetailsSidePanel } from "./listing_details_side_panel";

const { Component } = owl;

export default class ListingAllSidePanel extends Component {
    constructor() {
        super(...arguments);
        this.getters = this.env.getters;
    }

    selectListing(listId) {
        this.env.dispatch("SELECT_ODOO_LIST", { listId });
    }

    resetListingSelection() {
        this.env.dispatch("SELECT_ODOO_LIST");
    }
}
ListingAllSidePanel.template = "documents_spreadsheet.ListingAllSidePanel";
ListingAllSidePanel.components = { ListingDetailsSidePanel };
