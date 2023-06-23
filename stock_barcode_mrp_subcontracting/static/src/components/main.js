/** @odoo-module **/

import { bus } from "@web/legacy/js/services/core";
import MainComponent from '@stock_barcode/components/main';
import { patch } from '@web/legacy/js/core/utils';

patch(MainComponent.prototype, 'stock_barcode_mrp_subcontracting', {
    async recordComponents() {
        const {action, options} = await this.env.model._getActionRecordComponents();
        options.on_close = async (ev) => {
            if (ev === undefined) {
                await this._onRefreshState({ recordId: this.resId });
                this.render(true);
            }
        };
        await bus.trigger('do-action', {action, options});
    },
});
