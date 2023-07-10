/** @odoo-module */

import { Record } from "@web/model/relational_model/record";

export class FsmProductRecord extends Record {
    /**
     * @override
     */
    async _update(changes) {
        if ("fsm_quantity" in changes && Object.keys(changes).length === 1) {
            const action = await this.model.orm.call(
                this.resModel,
                "set_fsm_quantity",
                [this.resId, changes.fsm_quantity],
                { context: this.context }
            );
            if (action && action !== true) {
                await this.model.action.doAction(action, {
                    onClose: () => this._load(),
                });
            } else {
                await this._load();
            }
            return;
        }
        super._update(changes);
    }
}
