/** @odoo-module */

import PivotDetailsSidePanel from "./pivot_details_side_panel";

const { Component } = owl;

export default class PivotSidePanel extends Component {
    setup() {
        this.getters = this.env.getters;
    }

    selectPivot(pivotId) {
        this.env.dispatch("SELECT_PIVOT", { pivotId });
    }

    resetSelectedPivot() {
        this.env.dispatch("SELECT_PIVOT");
    }
}
PivotSidePanel.template = "documents_spreadsheet.PivotSidePanel";
PivotSidePanel.components = { PivotDetailsSidePanel };
