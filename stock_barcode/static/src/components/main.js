/** @odoo-module **/

import { Chatter } from "@mail/web/chatter";

import BarcodePickingModel from '@stock_barcode/models/barcode_picking_model';
import BarcodeQuantModel from '@stock_barcode/models/barcode_quant_model';
import { bus } from 'web.core';
import config from 'web.config';
import GroupedLineComponent from '@stock_barcode/components/grouped_line';
import LineComponent from '@stock_barcode/components/line';
import PackageLineComponent from '@stock_barcode/components/package_line';
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import * as BarcodeScanner from '@web/webclient/barcode/barcode_scanner';
import { ConfirmationDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { View } from "@web/views/view";
import { ManualBarcodeScanner } from './manual_barcode';

const { Component, onMounted, onPatched, onWillStart, onWillUnmount, useState, useSubEnv } = owl;

/**
 * Main Component
 * Gather the line information.
 * Manage the scan and save process.
 */

class MainComponent extends Component {
    //--------------------------------------------------------------------------
    // Lifecycle
    //--------------------------------------------------------------------------

    setup() {
        this.rpc = useService('rpc');
        this.orm = useService('orm');
        this.notification = useService('notification');
        this.dialog = useService('dialog');
        this.resModel = this.props.action.res_model;
        this.resId = this.props.action.context.active_id || false;
        const model = this._getModel();
        useSubEnv({model});
        this._scrollBehavior = 'smooth';
        this.isMobile = config.device.isMobile;
        this.state = useState({
            view: "barcodeLines", // Could be also 'printMenu' or 'editFormView'.
            displayNote: false,
        });

        onWillStart(async () => {
            const barcodeData = await this.rpc(
                '/stock_barcode/get_barcode_data',
                { model: this.resModel, res_id: this.resId }
            );
            barcodeData.actionId = this.props.actionId;
            this.groups = barcodeData.groups;
            this.env.model.setData(barcodeData);
            this.state.displayNote = Boolean(this.env.model.record.note);
            this.env.model.on('flash', this, this.flashScreen);
            this.env.model.on('process-action', this, this._onDoAction);
            this.env.model.on('refresh', this, this._onRefreshState);
            this.env.model.on('update', this, () => this.render(true));
            this.env.model.on('do-action', this, args => bus.trigger('do-action', args));
            this.env.model.on('history-back', this, () => this.env.config.historyBack());
        });

        onMounted(() => {
            bus.on('barcode_scanned', this, this._onBarcodeScanned);
            bus.on('refresh', this, this._onRefreshState);
            bus.on('warning', this, this._onWarning);
        });

        onWillUnmount(() => {
            this.env.model.off('flash', this, this.flashScreen)
            bus.off('barcode_scanned', this, this._onBarcodeScanned);
            bus.off('refresh', this, this._onRefreshState);
            bus.off('warning', this, this._onWarning);
        });

        onPatched(() => {
            this._scrollToSelectedLine();
        });
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    get highlightValidateButton() {
        return this.env.model.highlightValidateButton;
    }

    get isTransfer() {
        return this.currentSourceLocation && this.currentDestinationLocation;
    }

    get lineFormViewProps() {
        return {
            resId: this._editedLineParams && this._editedLineParams.currentId,
            resModel: this.env.model.lineModel,
            context: this.env.model._getNewLineDefaultContext(),
            viewId: this.env.model.lineFormViewId,
            display: { controlPanel: false },
            mode: "edit",
            type: "form",
            onSave: (record) => this.saveFormView(record),
            onDiscard: () => this.toggleBarcodeLines(),
        };
    }

    get lines() {
        return this.env.model.groupedLines;
    }

    get mobileScanner() {
        return BarcodeScanner.isBarcodeScannerSupported();
    }

    get packageLines() {
        return this.env.model.packageLines;
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _getModel() {
        const services = { rpc: this.rpc, orm: this.orm, notification: this.notification };
        if (this.resModel === 'stock.picking') {
            services.dialog = this.dialog;
            return new BarcodePickingModel(this.resModel, this.resId, services);
        } else if (this.resModel === 'stock.quant') {
            return new BarcodeQuantModel(this.resModel, this.resId, services);
        } else {
            throw new Error('No JS model define');
        }
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    async cancel() {
        await this.env.model.save();
        const action = await this.orm.call(
            this.resModel,
            'action_cancel_from_barcode',
            [[this.resId]]
        );
        const onClose = res => {
            if (res && res.cancelled) {
                this.env.model._cancelNotification();
                this.env.config.historyBack();
            }
        };
        bus.trigger('do-action', {
            action,
            options: {
                on_close: onClose.bind(this),
            },
        });
    }

    onBarcodeScanned(barcode) {
        if (barcode) {
            this.env.model.processBarcode(barcode);
            if ('vibrate' in window.navigator) {
                window.navigator.vibrate(100);
            }
        } else {
            const message = this.env._t("Please, Scan again!");
            this.env.services.notification.add(message, { type: 'warning' });
        }
    }

    async openMobileScanner() {
        const barcode = await BarcodeScanner.scanBarcode();
        this.onBarcodeScanned(barcode);
    }

    openManualScanner() {
        this.dialog.add(ManualBarcodeScanner, {
            openMobileScanner: async () => {
                await this.openMobileScanner();
            },
            onApply: (barcode) => {
                barcode = this.env.model.cleanBarcode(barcode);
                this.onBarcodeScanned(barcode);
                return barcode;
            }
        });
    }

    async exit(ev) {
        if (this.state.view === "barcodeLines") {
            await this.env.model.save();
            this.env.config.historyBack();
        } else {
            this.toggleBarcodeLines();
        }
    }

    flashScreen() {
        const clientAction = document.querySelector('.o_barcode_client_action');
        // Resets the animation (in case it still going).
        clientAction.style.animation = 'none';
        clientAction.offsetHeight; // Trigger reflow.
        clientAction.style.animation = null;
        // Adds the CSS class linked to the keyframes animation `white-flash`.
        clientAction.classList.add('o_white_flash');
    }

    putInPack(ev) {
        ev.stopPropagation();
        this.env.model._putInPack();
    }

    saveFormView(lineRecord) {
        const lineId = (lineRecord && lineRecord.data.id) || (this._editedLineParams && this._editedLineParams.currentId);
        const recordId = (lineRecord.resModel === this.resModel) ? lineId : undefined;
        this._onRefreshState({ recordId, lineId });
    }

    toggleBarcodeActions() {
        this.state.view = "actionsView";
    }

    async toggleBarcodeLines(lineId) {
        await this.env.model.displayBarcodeLines(lineId);
        this._editedLineParams = undefined;
        this.state.view = "barcodeLines";
    }

    async toggleInformation() {
        await this.env.model.save();
        this.state.view = "infoFormView";
    }

    /**
     * Calls `validate` on the model and then triggers up the action because OWL
     * components don't seem able to manage wizard without doing custom things.
     *
     * @param {OdooEvent} ev
     */
    async validate(ev) {
        ev.stopPropagation();
        await this.env.model.validate();
    }

    /**
     * Handler called when a barcode is scanned.
     *
     * @private
     * @param {string} barcode
     */
    _onBarcodeScanned(barcode) {
        if (this.state.view === "barcodeLines") {
            this.env.model.processBarcode(barcode);
        }
    }

    _scrollToSelectedLine() {
        if (!this.state.view === "barcodeLines" && this.env.model.canBeProcessed) {
            this._scrollBehavior = 'auto';
            return;
        }
        let selectedLine = document.querySelector('.o_sublines .o_barcode_line.o_highlight');
        const isSubline = Boolean(selectedLine);
        if (!selectedLine) {
            selectedLine = document.querySelector('.o_barcode_line.o_highlight');
        }
        if (!selectedLine) {
            const matchingLine = this.env.model.findLineForCurrentLocation();
            if (matchingLine) {
                selectedLine = document.querySelector(`.o_barcode_line[data-virtual-id="${matchingLine.virtual_id}"]`);
            }
        }
        if (selectedLine) {
            // If a line is selected, checks if this line is on the top of the
            // page, and if it's not, scrolls until the line is on top.
            const header = document.querySelector('.o_barcode_header');
            const lineRect = selectedLine.getBoundingClientRect();
            const navbar = document.querySelector('.o_main_navbar');
            const page = document.querySelector('.o_barcode_lines');
            // Computes the real header's height (the navbar is present if the page was refreshed).
            const headerHeight = navbar ? navbar.offsetHeight + header.offsetHeight : header.offsetHeight;
            if (lineRect.top < headerHeight || lineRect.bottom > (headerHeight + lineRect.height)) {
                let top = lineRect.top - headerHeight + page.scrollTop;
                if (isSubline) {
                    const parentLine = selectedLine.closest('.o_barcode_lines > .o_barcode_line');
                    const parentSummary = parentLine.querySelector('.o_barcode_line_summary');
                    top -= parentSummary.getBoundingClientRect().height;
                }
                page.scroll({ left: 0, top, behavior: this._scrollBehavior });
                this._scrollBehavior = 'smooth';
            }

        }
    }

    async _onDoAction(ev) {
        bus.trigger('do-action', {
            action: ev,
            options: {
                on_close: this._onRefreshState.bind(this),
            },
        });
    }

    onOpenPackage(packageId) {
        this._inspectedPackageId = packageId;
        this.state.view = "packagePage";
    }

    async onOpenProductPage(line) {
        await this.env.model.save();
        if (line) {
            const virtualId = line.virtual_id;
            // Updates the line id if it's missing, in order to open the line form view.
            if (!line.id && virtualId) {
                line = this.env.model.pageLines.find(l => l.dummy_id === virtualId);
            }
            this._editedLineParams = this.env.model.getEditedLineParams(line);
        }
        this.state.view = "productPage";
    }

    async _onRefreshState(paramsRefresh) {
        const { recordId, lineId } = paramsRefresh || {}
        const { route, params } = this.env.model.getActionRefresh(recordId);
        const result = await this.rpc(route, params);
        await this.env.model.refreshCache(result.data.records);
        await this.toggleBarcodeLines(lineId);
        this.render();
    }

    /**
     * Handles triggered warnings. It can happen from an onchange for example.
     *
     * @param {CustomEvent} ev
     */
    _onWarning(ev) {
        const { title, message } = ev.detail;
        this.env.services.dialog.add(ConfirmationDialog, { title, body: message });
    }
}
MainComponent.props = ["action", "actionId?", "className?", "globalState?", "resId?"];
MainComponent.template = 'stock_barcode.MainComponent';
MainComponent.components = {
    Chatter,
    View,
    GroupedLineComponent,
    LineComponent,
    PackageLineComponent,
};

registry.category("actions").add("stock_barcode_client_action", MainComponent);

export default MainComponent;
