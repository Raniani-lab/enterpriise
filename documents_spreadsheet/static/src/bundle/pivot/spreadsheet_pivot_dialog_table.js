/** @odoo-module */
const { Component } = owl;

export class PivotDialogTable extends Component {
    _onCellClicked(formula) {
        this.props.onCellSelected({ formula });
    }
}
PivotDialogTable.template = "documents_spreadsheet.PivotDialogTable";
