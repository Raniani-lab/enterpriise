/** @odoo-module **/

import { Component } from "@odoo/owl";
import { Dialog } from "@web/core/dialog/dialog";

export class SpreadsheetDialog extends Component {
    setup() {
        this.state = {
            inputContent: this.props.inputContent,
        };
    }

    confirm() {
        this.props.close();
        this.props.confirm?.(this.state.inputContent);
    }
}

SpreadsheetDialog.components = { Dialog };

SpreadsheetDialog.props = {
    close: Function,
    content: { type: String, optional: true },
    edit: { type: Boolean, optional: true },
    inputType: { type: String, optional: true },
    inputContent: { type: [String, Number], optional: true },
    errorText: { type: String, optional: true },
    confirm: { type: Function, optional: true },
    title: { type: String, optional: true },
};
SpreadsheetDialog.template = "spreadsheet_edition.SpreadsheetDialog";
