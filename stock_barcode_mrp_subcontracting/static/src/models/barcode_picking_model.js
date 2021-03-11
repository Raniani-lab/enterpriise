/** @odoo-module **/

import BarcodePickingModel from '@stock_barcode/models/barcode_picking_model';
import { patch } from 'web.utils';
import { _t } from 'web.core';

patch(BarcodePickingModel.prototype, 'stock_barcode_mrp_subcontracting', {

    showSubcontractingDetails(line) {
        return line.is_subcontract_stock_barcode && !['done', 'cancel'].includes(line.state) && this.getQtyDone(line);
    },

    get displayActionRecordComponents() {
        if (!this.params.model || !this.params.id) {
            return false;
        }
        const picking = this.cache.getRecord(this.params.model, this.params.id);
        return picking.display_action_record_components;
    },

    _actionRecordComponents(line) {
        const moveId = line && line.move_id || false;
        return this._getActionRecordComponents(moveId).then(
            res => this.trigger('do-action', res),
            error => this.trigger('notification', error)
        );
    },

    async _getActionRecordComponents(moveId) {
        await this.save();
        let action = false;
        if (moveId) {
            action = await this.orm.call(
                'stock.move',
                'action_show_details',
                [[moveId]]
            );
        } else {
            action = await this.orm.call(
                this.params.model,
                'action_record_components',
                [[this.params.id]]
            );
        }
        if (!action) {
            return Promise.reject({
                message: _t('No components to register'),
                type: 'danger',
            });
        }
        const options = {
            on_close: () => {
                this.trigger('refresh');
            },
        };
        return { action, options };
    },

    async _getActionSubcontractingDetails(line) {
        await this.save();
        const action = await this.orm.call(
            'stock.move',
            'action_show_subcontract_details',
            [[line.move_id]]
        );
        const options = {
            on_no_action: () => {
                this.trigger('notification', {
                    message: _t('Nothing to show'),
                    type: 'danger',
                });
            }
        };
        return {action, options};
    },

    _getCommands() {
        return Object.assign(this._super(), {
            'O-BTN.record-components': this._actionRecordComponents.bind(this),
        });
    },

    async _updateLineQty(line, args) {
        if (line.is_subcontract_stock_barcode) {
            await this._actionRecordComponents(line);
        } else {
            this._super(...arguments);
        }
    }
});
