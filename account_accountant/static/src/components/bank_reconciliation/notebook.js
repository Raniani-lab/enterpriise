/** @odoo-module **/
import { Notebook } from  "@web/core/notebook/notebook"
import { useState, useEffect, onPatched } from "@odoo/owl"

/**
 * Custom notebook allowing to keep in memory the existing loaded tabs.
 */
export class BankRecNotebook extends Notebook {

    setup() {
        super.setup();

        this.globalState = useState(this.env.methods.getState());

        useEffect(
            () => {
                if(this.globalState.bankRecNotebookPage !== this.state.currentPage){
                    this.globalState.bankRecNotebookPage = this.state.currentPage;
                }
            },
            () => [this.state.currentPage],
        );
        useEffect(
            () => {
                if(this.globalState.bankRecNotebookPage !== this.state.currentPage){
                    this.state.currentPage = this.globalState.bankRecNotebookPage || this.pages[0][0];
                }
            },
            () => [this.globalState.bankRecNotebookPage],
        );

        onPatched(() => {
            if(
                this.globalState.bankRecClickedColumn
                && this.env.methods.focusManualOperationField(this.globalState.bankRecClickedColumn)
            ){
                this.globalState.bankRecClickedColumn = null;
            }
        });
    }

}
