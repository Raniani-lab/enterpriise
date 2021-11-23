/** @odoo-module */

export class PivotDialogTable extends owl.Component {
    _onCellClicked(formula) {
        this.trigger('cell-selected', { formula });
    }
}
PivotDialogTable.template = "documents_spreadsheet.PivotDialogTable";
