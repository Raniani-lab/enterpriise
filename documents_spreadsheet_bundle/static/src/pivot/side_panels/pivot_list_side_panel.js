/** @odoo-module */

import PivotDetailsSidePanel from "./pivot_details_side_panel";

const { Component } = owl;

export default class PivotSidePanel extends Component {
    selectPivot(pivotId) {
        this.env.model.dispatch("SELECT_PIVOT", { pivotId });
    }

    resetSelectedPivot() {
        this.env.model.dispatch("SELECT_PIVOT");
    }
}
PivotSidePanel.template = "documents_spreadsheet.PivotSidePanel";
PivotSidePanel.components = { PivotDetailsSidePanel };
