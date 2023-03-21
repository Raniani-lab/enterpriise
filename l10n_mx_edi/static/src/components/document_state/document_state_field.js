/** @odoo-module **/
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

import { SelectionField, selectionField } from "@web/views/fields/selection/selection_field";

import { Component } from "@odoo/owl";

export class DocumentStatePopover extends Component {
    static template = "l10n_mx_edi.DocumentStatePopover";
    static props = {
        close: Function,
        onClose: Function,
        message: String,
    };
}

export class DocumentState extends SelectionField {
    static template = "l10n_mx_edi.DocumentState";

    setup() {
        this.popover = useService("popover");
    }

    get message(){
        return this.props.record.data.message;
    }

    showMessagePopover(ev){
        const close = () => {
            this.popoverCloseFn();
            this.popoverCloseFn = null;
        }

        if (this.popoverCloseFn){
            close();
            return;
        }

        this.popoverCloseFn = this.popover.add(
            ev.currentTarget,
            DocumentStatePopover,
            {
                message: this.message,
                onClose: close,
            },
            {
                closeOnClickAway: true,
                position: "top",
            },
        );
    }
}

registry.category("fields").add("l10n_mx_edi_document_state", {
    ...selectionField,
    component: DocumentState,
});
