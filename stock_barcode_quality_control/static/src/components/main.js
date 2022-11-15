/** @odoo-module **/

import { bus } from 'web.core';
import MainComponent from '@stock_barcode/components/main';
import { patch } from 'web.utils';

patch(MainComponent.prototype, 'stock_barcode_quality_control', {
    get hasQualityChecksTodo() {
        return this.env.model.record && this.env.model.record.quality_check_todo;
    },

    async checkQuality(ev) {
        ev.stopPropagation();
        await this.env.model.save();
        const res = await this.orm.call(
            this.resModel,
            this.env.model.openQualityChecksMethod,
            [[this.resId]]
        );
        if (typeof res === 'object' && res !== null) {
            return bus.trigger('do-action', {
                action: res,
                options: {
                    on_close: this._onRefreshState.bind(this, { recordId: this.resId }),
                },
            });
        } else {
            this.notification.add(this.env._t("All the quality checks have been done"));
        }
    },
});
