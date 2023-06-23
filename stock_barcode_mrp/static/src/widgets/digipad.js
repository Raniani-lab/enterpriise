/** @odoo-module **/

import { Digipad } from '@stock_barcode/widgets/digipad';

import { patch } from '@web/legacy/js/core/utils';

patch(Digipad.prototype, 'stock_barcode_mrp', {
    get changes() {
        const changes = this._super();
        if ( 'manual_consumption' in this.props.record.data ) {
            changes.manual_consumption = true;
        }
        return changes;
    }
});
