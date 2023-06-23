/** @odoo-module **/

import MainComponent from "@stock_barcode/components/main";
import BarcodeMRPModel from "../models/barcode_mrp_model";
import HeaderComponent from "./header";
import { ConfirmationDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { _t } from "@web/legacy/js/services/core";
import { patch } from '@web/legacy/js/core/utils';
import { useState } from "@odoo/owl";

patch(MainComponent.prototype, 'stock_barcode_mrp', {
    setup() {
        this._super();
        this.state = useState({ ...this.state, displayByProduct: false });
    },

    get displayActionButtons() {
        return this._super() && !this.state.displayByProduct;
    },

    get produceBtnLabel() {
        if (this.env.model.record.qty_producing < this.env.model.record.product_qty){
            return _t('Produce');
        }
        return _t('Produce All');
    },

    get headerFormViewProps() {
        return {
            resId: this.resId || this.env.model.record.id,
            resModel: this.resModel,
            context: { set_qty_producing: true },
            viewId: this.env.model.headerViewId,
            display: { controlPanel: false },
            type: "form",
            onSave: (record) => this.saveFormView(record),
            onDiscard: () => this.toggleBarcodeLines(),
        };
    },

    get scrapViewProps() {
        const context = this.env.model._getNewLineDefaultContext({ scrapProduct: true });
        context['product_ids'] = this.env.model.pageLines.map(line => line.product_id.id );
        return {
            resModel: 'stock.scrap',
            context: context,
            viewId: this.env.model.scrapViewId,
            display: { controlPanel: false },
            mode: "edit",
            type: "form",
            onSave: () => this.toggleBarcodeLines(),
            onDiscard: () => this.toggleBarcodeLines(),
        };
    },

    get lineFormViewProps() {
        const res = this._super();
        const params = { newByProduct: this.state.displayByProduct };
        res.context = this.env.model._getNewLineDefaultContext(params);
        return res;
    },

    get lines() {
        if (this.state.displayByProduct) {
            return this.env.model.byProductLines;
        }
        return this.env.model.groupedLines;
    },

    get addLineBtnName() {
        if (this.env.model.resModel == 'mrp.production' && this.env.model.record.product_id) {
            return this.env._t('Add Component');
        }
        return this._super();
    },

    exit(ev) {
        if (this.state.view === "barcodeLines" && this.state.displayByProduct) {
            this.state.displayByProduct = false;
        } else {
            this._super(...arguments);
        }
    },

    async cancel() {
        if (this.resModel == 'mrp.production') {
            await new Promise((resolve, reject) => {
                this.dialog.add(ConfirmationDialog, {
                    body: _t("Are you sure you want to cancel this manufacturing order?"),
                    title: _t("Cancel manufacturing order?"),
                    cancel: reject,
                    confirm: async () => {
                        await this.orm.call(
                            this.resModel,
                            'action_cancel',
                            [[this.env.model.resId]]
                        );
                        resolve();
                    },
                    close: reject,
                });
            });
            this.env.model._cancelNotification();
            this.env.config.historyBack();
            return;
        }
        await this._super(...arguments);
    },

    async toggleHeaderView() {
        await this.env.model.save();
        this.state.view = 'headerProductPage';
    },

    openByProductLines() {
        this._editedLineParams = undefined;
        this.state.displayByProduct = true;
    },

    async newScrapProduct() {
        await this.env.model.save();
        this.state.view = 'scrapProductPage';
    },

    onOpenProductPage(line) {
        if (this.resModel == 'mrp.production' && !this.env.model.record.product_id) {
            this.toggleHeaderView();
            return;
        }
        return this._super(...arguments);
    },

    async saveFormView(lineRecord) {
        if (lineRecord.resModel === 'mrp.production') {
            const recordId = lineRecord.resId;
            if (!this.resId) {
                this.resId = recordId;
                await this.env.model.confirmAndSetData(recordId);
                this.toggleBarcodeLines();
            } else {
                if (lineRecord.data.product_qty != this.env.model.record.product_qty) {
                    // need to reassign moves to update the quants on screen
                    await this.orm.call(
                        this.resModel,
                        'action_assign',
                        [[this.resId]]
                    );
                }
                this._onRefreshState({ recordId });
            }
            return;
        }
        return this._super(...arguments);
    },

    async _onRefreshByProducts() {
        const { route, params } = this.env.model.getActionRefresh(this.resId);
        const result = await this.rpc(route, params);
        await this.env.model.refreshCache(result.data.records);
        this.openByProductLines();
    },

    onValidateByProduct() {
        this.state.displayByProduct = false;
        this.toggleBarcodeLines();
    },

    _getModel() {
        const { resId, resModel, rpc, notification, orm } = this;
        if (this.resModel === 'mrp.production') {
            return new BarcodeMRPModel(resModel, resId, { rpc, notification, orm });
        }
        return this._super(...arguments);
    },

    _getHeaderHeight() {
        const headerHeight = this._super();
        const mo_header = document.querySelector('.o_header');
        return mo_header ? headerHeight + mo_header.offsetHeight: headerHeight;
    },
});

MainComponent.components.Header = HeaderComponent;
