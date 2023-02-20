/** @odoo-module */
import { Component } from "@odoo/owl";

export class PivotDialogTable extends Component {
    _onCellClicked(formula) {
        this.props.onCellSelected({ formula });
    }
}
PivotDialogTable.template = "spreadsheet_edition.PivotDialogTable";
