/** @odoo-module **/

import { bus } from 'web.core';
import LineComponent from '@stock_barcode/components/line';
import { patch } from 'web.utils';

patch(LineComponent.prototype, 'stock_barcode_mrp_subcontracting', {
    async showSubcontractingDetails() {
        const action = await this.env.model._getActionSubcontractingDetails(this.line);
        await bus.trigger('do-action', { action });
    },
});
