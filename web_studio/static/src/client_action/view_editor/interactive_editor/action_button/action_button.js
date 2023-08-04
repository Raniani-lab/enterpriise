/** @odoo-module */

import { Dialog } from "@web/core/dialog/dialog";
import { Dropdown } from "@web/core/dropdown/dropdown";
import { DropdownItem } from "@web/core/dropdown/dropdown_item";
import { Record } from "@web/views/record";
import { Many2OneField } from "@web/views/fields/many2one/many2one_field";
import { AutoComplete } from "@web/core/autocomplete/autocomplete";
import { Component, useState } from "@odoo/owl";
import { useOwnedDialogs, useService} from "@web/core/utils/hooks";
import { _t } from "@web/core/l10n/translation";

export class DialogAddNewButton extends Component {
    static template = `web_studio.DialogNewButtonStatusBar`;
    static components = {
        AutoComplete,
        Dialog,
        Dropdown,
        DropdownItem,
        Many2OneField,
        Record,
    };
    static props = {
        model: { type: String },
        onConfirm: { type: Function },
        close: { type: Function },
    };
    setup() {
        this.rpc = useService("rpc");
        this.state = useState({
            action: "",
            button_type: "",
            actionId: "",
            methodId: "",
            methodList: [],
            error: "", 
            methodChecked : false, 
        });
        const actionId = {
            type: "many2one",
            relation: "ir.actions.actions",
        };

        const self = this; 
        this.recordProps = {
            activeFields: { actionId },
            fields: { actionId },
            get values() {
                return {
                    actionId: self.state.actionId,
                };
            },
            onRecordChanged: (rec) => {
                this.state.actionId = rec.data.actionId;
            },
        };
    }
    get title() {
        return _t('Buttons Properties');
    }

    get checkValidity() {
        if (this.state.label?.length > 0) {
            if (this.state.button_type === "action" && this.state.actionId?.length > 0) {
                return false;
            } else if (this.state.methodChecked && this.state.button_type === "object" && 
                    this.state.methodId?.length > 0 && this.state.error?.length === 0) {
                return false;
            } else {
                return true;
            }
        } else {
            return true;
        }
    }
    onChange() {
        this.state.actionId = null;
        this.state.methodId = null;
    }
    onConfirm() {
        this.props.onConfirm(this.state);
        this.props.close();
    }
    onCancel() {
        this.props.close();
    }
    async checkMethod() {
        this.state.error = "";
        this.state.methodChecked = false
        if(this.state.methodId?.length > 0) {
            if(this.state.methodId.startsWith("_")) {
                this.state.error = _t("The method %s is private.", this.state.methodId);
            }
            else {
                try {
                    await this.rpc("/web_studio/check_method", {
                        model_name : this.props.model, 
                        method_name : this.state.methodId, 
                    });
                }
                catch(error) {
                    if(error?.data?.message?.length > 0) this.state.error = error.data.message;
                }
                this.state.methodChecked = true;
            }
        }
    }

}

export class AddButtonAction extends Component {
    static props = {};
    static template = `web_studio.AddButtonAction`;
    setup() {
        this.addDialog = useOwnedDialogs();
    }
    onClick() {
        this.addDialog(DialogAddNewButton, {
            model: this.env.viewEditorModel.resModel,
            onConfirm: (state) => {
                const viewEditorModel = this.env.viewEditorModel;
                const arch = viewEditorModel.xmlDoc;
                const findHeader = arch.firstChild.querySelector(":scope > header")
                if(!findHeader) {
                    viewEditorModel.pushOperation({
                        type: "statusbar",
                        view_id: this.env.viewEditorModel.view.id,
                    });
                }
                viewEditorModel.doOperation({
                    type: "add_button_action",
                    button_type: state.button_type,
                    actionId: state.actionId && state.actionId[0],
                    methodId: state.methodId,
                    label: state.label,
                });
            },
        });
    }
}
