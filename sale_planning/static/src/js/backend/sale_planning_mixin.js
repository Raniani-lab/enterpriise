/** @odoo-module */

import { _t } from 'web.core';

export const SalePlanningControllerMixin = {

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * Handler for "Plan Orders" button
     * @private
     * @param {MouseEvent} ev
     */
    async _onPlanSOClicked(ev) {
        ev.preventDefault();
        const result = await this._rpc({
            model: this.modelName,
            method: 'action_plan_sale_order',
            args: [
                this.model._getDomain(),
            ],
            context: this.addViewContextValues(this.context),
        });
        if (result) {
            this.displayNotification({
                type: 'success',
                message: _t("The sales orders have successfully been assigned."),
            });
        } else {
            this.displayNotification({
                type: 'danger',
                message: _t('There are no sales orders to assign or no employees are available.'),
            });
        }
        this.reload();
    },
};
