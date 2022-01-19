/** @odoo-module */

const { Component } = owl;

export class PivotDialogTable extends Component {
    _onCellClicked(formula) {
        this.trigger('cell-selected', { formula });
    }
}
PivotDialogTable.template = "documents_spreadsheet.PivotDialogTable";
