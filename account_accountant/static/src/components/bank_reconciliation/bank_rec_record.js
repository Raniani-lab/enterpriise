/** @odoo-module **/

import { Record } from "@web/model/relational_model/record";
import { RelationalModel } from "@web/model/relational_model/relational_model";

export class BankRecRecord extends Record {

    /**
     * override
     * Track the changed field on lines.
     */
    async _update(changes) {
        if(this.resModel === "bank.rec.widget.line"){
            for(const fieldName of Object.keys(changes)){
                this.model.lineIdsChangedField = fieldName;
            }
        }
        return super._update(...arguments);
    }

    updateToDoCommand(methodName, args, kwargs) {
        return this._update(
            {
                todo_command: {
                    method_name: methodName,
                    args: args,
                    kwargs: kwargs,
                },
            },
        );
    }

    /**
     * Bind an action to be called when a field on lines changed.
     * @param {Function} callback: The action to call taking the changed field as parameter.
     */
    bindActionOnLineChanged(callback){
        this._onUpdate = async () => {
            const lineIdsChangedField = this.model.lineIdsChangedField;
            if(lineIdsChangedField){
                this.model.lineIdsChangedField = null;
                await callback(lineIdsChangedField);
            }
        }
    }
}

export class BankRecRelationalModel extends RelationalModel{
    setup(params, { action, dialog, notification, rpc, user, view, company }) {
        super.setup(...arguments);
        this.lineIdsChangedField = null;
    }

    load({ values }) {
        this.root = this._createRoot(this.config, values);
    }

    getInitialValues() {
        return this.root._getChanges(this.root.data, { withReadonly: true })
    }
}
BankRecRelationalModel.Record = BankRecRecord;
