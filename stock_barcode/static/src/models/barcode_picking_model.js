/** @odoo-module **/

import BarcodeModel from '@stock_barcode/models/barcode_model';
import {_t, _lt} from "web.core";
import { sprintf } from '@web/core/utils/strings';

export default class BarcodePickingModel extends BarcodeModel {
    constructor(params) {
        super(...arguments);
        this.lineModel = 'stock.move.line';
        this.validateMessage = _t("The transfer has been validated");
        this.validateMethod = 'button_validate';
    }

    setData(data) {
        super.setData(...arguments);
        // Manage extra information for locations
        this.currentDestLocationId = this._defaultDestLocationId();
        if (this.pageLines.length > 0) {
            this.currentDestLocationId = this.pageLines[0].location_dest_id;
        }
        this.locationList = [];
        this.destLocationList = [];
        data.data.source_location_ids.forEach(id => {
            this.locationList.push(this.cache.getRecord('stock.location', id));
        });
        data.data.destination_locations_ids.forEach(id => {
            this.destLocationList.push(this.cache.getRecord('stock.location', id));
        });
        this._useReservation = this.initialState.lines.some(line => line.reserved_uom_qty);
        this.askBeforeNewLinesCreation = !this.record.immediate_transfer;
        this.config = data.data.config || {}; // Picking type's scan restrictions configuration.
        if (!this.displayDestinationLocation) {
            this.config.restrict_scan_dest_location = 'no';
        }
        this.scannedSourceLocation = false;
        this.scannedDestLocation = false;
        this.lineFormViewId = data.data.line_view_id;
        this.formViewId = data.data.form_view_id;
        this.packageKanbanViewId = data.data.package_view_id;
    }

    async changeDestinationLocation(id, moveScannedLineOnly) {
        if (this.config.restrict_scan_source_location) {
            // Forgets last scanned source if we have to scan it for each line.
            this.scannedSourceLocation = false;
        }
        if (this.currentDestLocationId == id) {
            // Already at the scanned location, so we don't change it, only reset some variables.
            this.scannedDestLocation = false;
            this.selectedLineVirtualId = false;
            this.lastScannedPackage = false;
            this.scannedLinesVirtualId = [];
            return;
        }
        this.currentDestLocationId = id;
        if (moveScannedLineOnly && this.previousScannedLines.length) {
            for (const line of this.previousScannedLines) {
                // If the line is complete, we move it...
                if (!line.reserved_uom_qty || line.qty_done >= line.reserved_uom_qty) {
                    line.location_dest_id = id;
                    this._markLineAsDirty(line);
                } else { // ... otherwise, we split it to a new line.
                    const newLine = Object.assign({}, line, this._getNewLineDefaultValues({}));
                    this.currentState.lines.push(newLine);
                    newLine.qty_done = line.qty_done;
                    line.qty_done = 0;
                    this._markLineAsDirty(newLine);
                }
            }
        } else {
            // If the button was used to change the location, if will change the
            // destination location of all the page's move lines.
            for (const line of this.pageLines) {
                line.location_dest_id = id;
                this._markLineAsDirty(line);
            }
        }
        // Forget what lines have been scanned.
        this.scannedLinesVirtualId = [];
        this.lastScannedPackage = false;
        this.selectedLineVirtualId = false;

        await this.save();
        this._groupLinesByPage(this.currentState);
        for (let i = 0; i < this.pages.length; i++) {
            const page = this.pages[i];
            if (page.sourceLocationId === this.currentLocationId &&
                page.destinationLocationId === this.currentDestLocationId) {
                this.pageIndex = i;
                break;
            }
        }
    }

    getDisplayIncrementBtn(line) {
        if (this.config.restrict_scan_product && line.product_id.barcode && !this.getQtyDone(line)) {
            return false;
        }
        return super.getDisplayIncrementBtn(...arguments);
    }

    getIncrementQuantity(line) {
        return Math.max(this.getQtyDemand(line) - this.getQtyDone(line), 1);
    }

    getQtyDone(line) {
        return line.qty_done;
    }

    getQtyDemand(line) {
        return line.reserved_uom_qty;
    }

    getEditedLineParams(line) {
        return Object.assign(super.getEditedLineParams(...arguments), { canBeDeleted: !line.reserved_uom_qty });
    }

    getDisplayIncrementPackagingBtn(line) {
        const packagingQty = line.product_packaging_uom_qty;
        return packagingQty &&
            (!this.getQtyDemand(line) || this.getQtyDemand(line) >= this.getQtyDone(line) + packagingQty);
    }

    lineCanBeSelected(line) {
        if (this.config.restrict_scan_source_location && !this.scannedSourceLocation) {
            return false; // Can't select a line if source is mandatory and wasn't scanned yet.
        }
        const product = line.product_id;
        if (this.config.restrict_scan_product && product.barcode) {
            // If the product scan is mandatory, a line can't be selected if its product isn't
            // scanned first (as we can't keep track of each line's product scanned state, we
            // consider a product was scanned if the line has a qty. greater than zero).
            if (product.tracking === 'none' || !this.config.restrict_scan_tracking_number) {
                return !this.getQtyDemand(line) || this.getQtyDone(line);
            } else if (product.tracking != 'none') {
                return line.lot_name || (line.lot_id && line.qty_done);
            }
        }
        return super.lineCanBeSelected(...arguments);
    }

    lineCanBeEdited(line) {
        if (line.product_id.tracking !== 'none' && this.config.restrict_scan_tracking_number &&
            !((line.lot_id && line.qty_done) || line.lot_name)) {
            return false;
        }
        return this.lineCanBeSelected(line);
    }

    nextPage() {
        this.highlightDestinationLocation = false;
        return super.nextPage(...arguments);
    }

    previousPage() {
        this.highlightDestinationLocation = false;
        return super.previousPage(...arguments);
    }

    async updateLine(line, args) {
        await super.updateLine(...arguments);
        let {result_package_id} = args;
        if (result_package_id) {
            if (typeof result_package_id === 'number') {
                result_package_id = this.cache.getRecord('stock.quant.package', result_package_id);
                if (result_package_id.package_type_id && typeof result_package_id === 'number') {
                    result_package_id.package_type_id = this.cache.getRecord('stock.package.type', result_package_id.package_type_id);
                }
            }
            line.result_package_id = result_package_id;
        }
    }

    updateLineQty(virtualId, qty = 1) {
        this.actionMutex.exec(() => {
            const line = this.pageLines.find(l => l.virtual_id === virtualId);
            this.updateLine(line, {qty_done: qty});
            this.trigger('update');
        });
    }

    get barcodeInfo() {
        if (this.isCancelled || this.isDone) {
            return {
                class: this.isDone ? 'picking_already_done' : 'picking_already_cancelled',
                message: this.isDone ?
                    _t("This picking is already done") :
                    _t("This picking is cancelled"),
                warning: true,
            };
        }
        const barcodeInfo = super.barcodeInfo;
        // Defines some messages who can appear in multiple cases.
        const infos = {
            scanScrLoc: {
                message: this.considerPackageLines ?
                    _lt("Scan the source location or a package") :
                    _lt("Scan the source location"),
                class: 'scan_src',
                icon: 'hdd-o',
            },
            scanDestLoc: {
                message: _lt("Scan the destination location"),
                class: 'scan_dest',
                icon: 'sign-in',
            },
            scanProductOrDestLoc: {
                message: this.considerPackageLines ?
                    _lt("Scan a product, a package or the destination location.") :
                    _lt("Scan a product or the destination location."),
                class: 'scan_product_or_dest',
                icon: 'sign-in',
            },
            pressValidateBtn: {
                message: this.displayValidateButton ?
                    _lt("Press Validate or scan another product") :
                    _lt("Press Next or scan another product"),
                class: 'scan_next_or_validate',
                icon: 'check-square',
            },
        };

        // About source location.
        if (this.displaySourceLocation && this.config.restrict_scan_source_location &&
            !this.scannedSourceLocation && !this.pageIsDone) {
            return infos.scanScrLoc;
        }

        // Takes the parent line if the current line is part of a group.
        const line = this._getParentLine(this.selectedLine) || this.selectedLine;

        if (!line && this._moveEntirePackage()) { // About package lines.
            const packageLine = this.selectedPackageLine;
            if (packageLine) {
                if (this._lineIsComplete(packageLine)) {
                    if (this.config.restrict_scan_source_location && !this.scannedSourceLocation) {
                        return infos.scanScrLoc;
                    } else if (this.config.restrict_scan_dest_location != 'no' && !this.scannedDestLocation) {
                        return this.config.restrict_scan_dest_location == 'mandatory' ?
                            infos.scanDestLoc :
                            infos.scanProductOrDestLoc;
                    } else if (this.pageIsDone) {
                        return infos.pressValidateBtn;
                    } else {
                        barcodeInfo.message = _lt("Scan a product or another package");
                        barcodeInfo.class = 'scan_product_or_package';
                    }
                } else {
                    barcodeInfo.message = sprintf(_t("Scan the package %s"), packageLine.result_package_id.name);
                    barcodeInfo.icon = 'archive';
                }
                return barcodeInfo;
            } else if (this.considerPackageLines && barcodeInfo.class == 'scan_product') {
                barcodeInfo.message = _lt("Scan a product or a package");
                barcodeInfo.class = 'scan_product_or_package';
            }
        }

        if (!line) {
            if (this.pageIsDone) {
                Object.assign(barcodeInfo, infos.pressValidateBtn);
            }
            return barcodeInfo;
        }
        const product = line.product_id;

        // About tracking numbers.
        if (product.tracking !== 'none') {
            if (this.getQtyDemand(line) && (line.lot_id || line.lot_name)) { // Reserved.
                if (this.getQtyDone(line) === 0) { // Lot/SN not scanned yet.
                    if (product.tracking === 'lot') {
                        barcodeInfo.message = _t("Scan the reserved lot number");
                        barcodeInfo.class = "scan_lot";
                    } else if (product.tracking === 'serial') {
                        barcodeInfo.message = _t("Scan the reserved serial number");
                        barcodeInfo.class = "scan_serial";
                    }
                    return barcodeInfo;
                } else if (this.getQtyDone(line) < this.getQtyDemand(line)) { // Lot/SN scanned but not enough.
                    if (product.tracking === 'lot') {
                        barcodeInfo.message = _t("Scan more lot numbers");
                        barcodeInfo.class = "scan_lot";
                    } else if (product.tracking === 'serial') {
                        barcodeInfo.message = _t("Scan another serial number");
                        barcodeInfo.class = "scan_serial";
                    }
                    return barcodeInfo;
                }
            } else if (!(line.lot_id || line.lot_name)) { // Not reserved.
                if (product.tracking === 'lot') {
                    barcodeInfo.message = _t("Scan a lot number");
                    barcodeInfo.class = "scan_lot";
                } else if (product.tracking === 'serial') {
                    barcodeInfo.message = _t("Scan a serial number");
                    barcodeInfo.class = "scan_serial";
                }
                return barcodeInfo;
            }
        }

        // About package.
        if (this._lineNeedsToBePacked(line)) {
            if (this._lineIsComplete(line)) {
                barcodeInfo.message = _t("Scan a package or put in pack");
                barcodeInfo.icon = 'archive';
            } else {
                if (product.tracking == 'serial') {
                    barcodeInfo.message = _t("Scan a serial number or a package");
                } else if (product.tracking == 'lot') {
                    barcodeInfo.message = line.qty_done == 0 ?
                        _t("Scan a lot number") :
                        _t("Scan more lot numbers or a package");
                        barcodeInfo.class = "scan_lot";
                } else {
                    barcodeInfo.message = _t("Scan more products or a package");
                }
            }
            return barcodeInfo;
        }

        if (this.pageIsDone) {
            Object.assign(barcodeInfo, infos.pressValidateBtn);
        }

        // About destination location.
        if (this.config.restrict_scan_dest_location != 'no') {
            if (this.pageIsDone) {
                if (this.scannedDestLocation) {
                    return infos.pressValidateBtn;
                } else {
                    return this.config.restrict_scan_dest_location == 'mandatory' ?
                        infos.scanDestLoc :
                        infos.scanProductOrDestLoc;
                }
            } else {
                if (this._lineIsComplete(line)) {
                    if (this.groups.group_tracking_lot && !line.result_package_id) {
                        barcodeInfo.message = _t("Scan a package or the destination location");
                    } else {
                        return this.config.restrict_scan_dest_location == 'mandatory' ?
                            infos.scanDestLoc :
                            infos.scanProductOrDestLoc;
                    }
                } else {
                    if (product.tracking == 'serial') {
                        barcodeInfo.message = this.groups.group_tracking_lot ?
                            _t("Scan a serial number or a package then the destination location") :
                            _t("Scan a serial number then the destination location");
                    } else if (product.tracking == 'lot') {
                        barcodeInfo.message = this.groups.group_tracking_lot ?
                            _t("Scan a lot number or a packages then the destination location") :
                            _t("Scan a lot number then the destination location");
                    } else {
                        barcodeInfo.message = this.groups.group_tracking_lot ?
                            _t("Scan a product, a package or the destination location") :
                            _t("Scan a product then the destination location");
                    }
                }
            }
        }

        return barcodeInfo;
    }

    get canBeProcessed() {
        return !['cancel', 'done'].includes(this.record.state);
    }

    /**
     * Depending of the config, a transfer can be fully validate even if nothing was scanned (like
     * with an immediate transfer) or if at least one product was scanned.
     * @returns {boolean}
     */
    get canBeValidate() {
        if (this.record.immediate_transfer) {
            return super.canBeValidate; // For immediate transfers, doesn't care about any special condition.
        } else if (this.config.restrict_scan_product && this.currentState.lines.some(line => line.product_id.barcode && !line.qty_done)) {
            return false; // Can't be validate because all product should be scanned and at least one was not.
        } else if (!this.config.barcode_validation_full && !this.currentState.lines.some(line => line.qty_done)) {
            return false; // Can't be validate because "full validation" is forbidden and nothing was processed yet.
        }
        return super.canBeValidate;
    }

    get canCreateNewLot() {
        return this.record.use_create_lots;
    }

    get canPutInPack() {
        if (this.config.restrict_scan_product) {
            return this.pageLines.some(line => line.qty_done && !line.result_package_id);
        }
        return true;
    }

    get canSelectLocation() {
        return !(this.config.restrict_scan_source_location || this.config.restrict_scan_dest_location != 'optional');
    }

    async changeSourceLocation(id, applyChangeToPageLines = false) {
        // For the pickings, changes the location will change the source
        // location of all the page's move lines.
        if (applyChangeToPageLines) {
            for (const moveLine of this.pageLines) {
                moveLine.location_id = id;
                this._markLineAsDirty(moveLine);
            }
            this._groupLinesByPage(this.currentState);
        }
        return super.changeSourceLocation(...arguments);
    }

    get considerPackageLines() {
        return this._moveEntirePackage() && this.packageLines;
    }

    get destLocation() {
        return this.cache.getRecord('stock.location', this.currentDestLocationId);
    }

    get displayCancelButton() {
        return !['done', 'cancel'].includes(this.record.state);
    }

    get displayDestinationLocation() {
        return this.groups.group_stock_multi_locations &&
            ['incoming', 'internal'].includes(this.record.picking_type_code);
    }

    get displayPutInPackButton() {
        return this.groups.group_tracking_lot && this.config.restrict_put_in_pack != 'no';
    }

    get displayResultPackage() {
        return true;
    }

    get displaySourceLocation() {
        return super.displaySourceLocation &&
            ['internal', 'outgoing'].includes(this.record.picking_type_code);
    }

    get displayValidateButton() {
        return (this.pageIndex + 1) === this.pages.length;
    }

    get highlightNextButton() {
        if (!this.pageLines.length && !this.packageLines.length) {
            return false;
        }
        for (let line of this.pageLines) {
            line = this._getParentLine(line) || line;
            if (this._lineIsNotComplete(line)) {
                return false;
            }
        }
        for (const packageLine of this.packageLines) {
            if (this._lineIsNotComplete(packageLine)) {
                return false;
            }
        }
        return Boolean([...this.pageLines, ...this.packageLines].length);
    }

    get highlightValidateButton() {
        return this.highlightNextButton;
    }

    get isDone() {
        return this.record.state === 'done';
    }

    get isCancelled() {
        return this.record.state === 'cancel';
    }

    lineIsFaulty(line) {
        return this._useReservation && line.qty_done > line.reserved_uom_qty;
    }

    get pageIsDone() {
        for (const line of this.groupedLines) {
            if (this._lineIsNotComplete(line) || this._lineNeedsToBePacked(line) ||
                (line.product_id.tracking != 'none' && !(line.lot_id || line.lot_name))) {
                return false;
            }
        }
        for (const line of this.packageLines) {
            if (this._lineIsNotComplete(line)) {
                return false;
            }
        }
        return Boolean([...this.groupedLines, ...this.packageLines].length);
    }

    get printButtons() {
        const buttons = [
            {
                name: _t("Print Picking Operations"),
                class: 'o_print_picking',
                method: 'do_print_picking',
            }, {
                name: _t("Print Delivery Slip"),
                class: 'o_print_delivery_slip',
                method: 'action_print_delivery_slip',
            }, {
                name: _t("Print Barcodes PDF"),
                class: 'o_print_barcodes_pdf',
                method: 'action_print_barcode_pdf',
            },
        ];
        if (this.groups.group_tracking_lot) {
            buttons.push({
                name: _t("Print Packages"),
                class: 'o_print_packages',
                method: 'action_print_packges',
            });
        }
        const picking_type_code = this.record.picking_type_code;
        const picking_state = this.record.state;
        if ( (picking_type_code === 'incoming') && (picking_state === 'done') ||
             (picking_type_code === 'outgoing') && (picking_state !== 'done') ||
             (picking_type_code === 'internal')
           ) {
            buttons.push({
                name: _t("Scrap"),
                class: 'o_scrap',
                method: 'button_scrap',
            });
        }

        return buttons;
    }

    get selectedLine() {
        const selectedLine = super.selectedLine;
        if (selectedLine && selectedLine.location_dest_id === this.currentDestLocationId) {
            return selectedLine;
        }
        return false;
    }

    get selectedPackageLine() {
        return this.lastScannedPackage && this.packageLines.find(pl => pl.result_package_id.id == this.lastScannedPackage);
    }

    get useExistingLots() {
        return this.record.use_existing_lots;
    }

    async validate() {
        if (this.config.restrict_scan_dest_location == 'mandatory' &&
            !this.scannedDestLocation && this.selectedLine) {
            return this.notification.add(_t("Destination location must be scanned"), { type: 'danger' });
        }
        if (this.config.lines_need_to_be_packed &&
            this.currentState.lines.some(line => this._lineNeedsToBePacked(line))) {
            return this.notification.add(_t("All products need to be packed"), { type: 'danger' });
        }
        return await super.validate();
    }

    // -------------------------------------------------------------------------
    // Private
    // -------------------------------------------------------------------------

    async _assignEmptyPackage(line, resultPackage) {
        const fieldsParams = this._convertDataToFieldsParams({ resultPackage });
        await this.updateLine(line, fieldsParams);
    }

    _getNewLineDefaultContext() {
        const picking = this.cache.getRecord(this.params.model, this.params.id);
        return {
            default_company_id: picking.company_id,
            default_location_id: this.location.id,
            default_location_dest_id: this.destLocation.id,
            default_picking_id: this.params.id,
            default_qty_done: 1,
        };
    }

    async _cancel() {
        await this.save();
        await this.orm.call(
            this.params.model,
            'action_cancel',
            [[this.params.id]]
        );
        this._cancelNotification();
        this.trigger('history-back');
    }

    _cancelNotification() {
        this.notification.add(_t("The transfer has been cancelled"));
    }

    async _changePage(pageIndex) {
        // The users can't change the page if the destination is mandatory but wasn't scanned.
        if (this.config.restrict_scan_dest_location == 'mandatory' && !this.scannedDestLocation && this.selectedLine) {
            return this.notification.add(_t("Destination location must be scanned"), { type: 'danger' });
        }
        await super._changePage(...arguments);
        this.currentDestLocationId = this.page.destinationLocationId;
        this.highlightDestinationLocation = false;
        // Resets scanned locations.
        this.scannedSourceLocation = false;
        this.scannedDestLocation = false;
    }

    _checkBarcode(barcodeData) {
        const check = {};
        const { location, lot, product, destLocation, packageType } = barcodeData;
        const resultPackage = barcodeData.package;
        if (this.config.restrict_scan_source_location && !this.scannedSourceLocation) { // Source Location.
            if (location) {
                this.scannedSourceLocation = location;
            } else {
                check.title = _t("Mandatory Source Location");
                check.message = sprintf(
                    _t("You are supposed to scan %s or another source location"),
                    this.location.display_name,
                );
            }
        } else if (this.config.restrict_scan_source_location && this.scannedSourceLocation &&
                   this.config.restrict_scan_dest_location == 'no' && barcodeData.destLocation) {
            // Special case where the user can not scan a dest. but a source was already scanned.
            // That means what is supposed to be a destination is in this case a source.
            barcodeData.location = barcodeData.destLocation;
            delete barcodeData.destLocation;
        } else if (this.config.restrict_scan_product && !(product || this.selectedLine)) { // Product.
            check.message = _t("You must scan a product");
            if (lot) {
                check.message = _t("Scan a product before scanning a tracking number");
            }
        } else if (this.config.restrict_put_in_pack == 'mandatory' && !(resultPackage || packageType) &&
                   this.selectedLine && !this.selectedLine.result_package_id &&
                   ((product && product.id != this.selectedLine.product_id.id) || location || destLocation)) { // Package.
            check.message = _t("You must scan a package or put in pack");
        } else if (this.config.restrict_scan_dest_location == 'mandatory' && !this.scannedDestLocation) { // Destination Location.
            if (destLocation) {
                this.scannedDestLocation = destLocation;
            } else if (product && this.selectedLine && this.selectedLine.product_id.id != product.id) {
                // Cannot scan another product before a destination was scanned.
                check.title = _t("Mandatory Destination Location");
                check.message = sprintf(
                    _t("Please scan destination location for %s before scanning other product"),
                    this.selectedLine.product_id.display_name
                );
            }
        }
        check.error = Boolean(check.message);
        return check;
    }

    async _closeValidate(ev) {
        const record = await this.orm.read(this.params.model, [this.record.id], ["state"])
        if (record[0].state === 'done') {
            // If all is OK, displays a notification and goes back to the previous page.
            this.notification.add(this.validateMessage, { type: 'success' });
            this.trigger('history-back');
        }
    }

    _convertDataToFieldsParams(args) {
        const params = {
            lot_name: args.lotName,
            product_id: args.product,
            qty_done: args.quantity,
        };
        if (args.lot) {
            params.lot_id = args.lot;
        }
        if (args.package) {
            params.package_id = args.package;
        }
        if (args.resultPackage) {
            params.result_package_id = args.resultPackage;
        }
        if (args.owner) {
            params.owner_id = args.owner;
        }
        return params;
    }

    _createCommandVals(line) {
        const values = {
            dummy_id: line.virtual_id,
            location_id: line.location_id,
            location_dest_id: line.location_dest_id,
            lot_name: line.lot_name,
            lot_id: line.lot_id,
            package_id: line.package_id,
            picking_id: line.picking_id,
            product_id: line.product_id,
            product_uom_id: line.product_uom_id,
            owner_id: line.owner_id,
            qty_done: line.qty_done,
            result_package_id: line.result_package_id,
            state: 'assigned',
        };
        for (const [key, value] of Object.entries(values)) {
            values[key] = this._fieldToValue(value);
        }
        return values;
    }

    _createLinesState() {
        const lines = [];
        const picking = this.cache.getRecord(this.params.model, this.params.id);
        for (const id of picking.move_line_ids) {
            const smlData = this.cache.getRecord('stock.move.line', id);
            // Checks if this line is already in the picking's state to get back
            // its `virtual_id` (and so, avoid to set a new `virtual_id`).
            const prevLine = this.currentState && this.currentState.lines.find(l => l.id === id);
            const previousVirtualId = prevLine && prevLine.virtual_id;
            smlData.virtual_id = Number(smlData.dummy_id) || previousVirtualId || this._uniqueVirtualId;
            smlData.product_id = this.cache.getRecord('product.product', smlData.product_id);
            smlData.product_uom_id = this.cache.getRecord('uom.uom', smlData.product_uom_id);
            smlData.lot_id = smlData.lot_id && this.cache.getRecord('stock.lot', smlData.lot_id);
            smlData.owner_id = smlData.owner_id && this.cache.getRecord('res.partner', smlData.owner_id);
            smlData.package_id = smlData.package_id && this.cache.getRecord('stock.quant.package', smlData.package_id);
            smlData.product_packaging_id = smlData.product_packaging_id && this.cache.getRecord('product.packaging', smlData.product_packaging_id);
            const resultPackage = smlData.result_package_id && this.cache.getRecord('stock.quant.package', smlData.result_package_id);
            if (resultPackage) { // Fetch the package type if needed.
                smlData.result_package_id = resultPackage;
                const packageType = resultPackage && resultPackage.package_type_id;
                resultPackage.package_type_id = packageType && this.cache.getRecord('stock.package.type', packageType);
            }
            lines.push(Object.assign({}, smlData));
        }
        return lines;
    }

    _defaultLocationId() {
        return this.record.location_id;
    }

    _defaultDestLocationId() {
        return this.record.location_dest_id;
    }

    /**
     * @override
     */
    _defineLocationId() {
        super._defineLocationId();
        if (this.page.lines.length) {
            this.currentDestLocationId = this.page.lines[0].location_dest_id;
        } else {
            this.currentDestLocationId = this._defaultDestLocationId();
        }
    }

    _getCommands() {
        return Object.assign(super._getCommands(), {
            'O-BTN.pack': this._putInPack.bind(this),
            'O-CMD.cancel': this._cancel.bind(this),
        });
    }

    _getDefaultMessageType() {
        if (this.displaySourceLocation && this.config.restrict_scan_source_location && (
            !this.highlightSourceLocation || this.highlightDestinationLocation)) {
            return 'scan_src';
        }
        return 'scan_product';
    }

    _getLocationMessage() {
        if (this.groups.group_stock_multi_locations) {
            if (this.record.picking_type_code === 'outgoing') {
                return 'scan_product_or_src';
            } else if (this.config.restrict_scan_dest_location != 'no') {
                return 'scan_product_or_dest';
            }
        }
        return 'scan_product';
    }

    _getModelRecord() {
        return this.cache.getRecord(this.params.model, this.params.id);
    }

    _getNewLineDefaultValues(fieldsParams) {
        const defaultValues = super._getNewLineDefaultValues(...arguments);
        return Object.assign(defaultValues, {
            location_dest_id: this.destLocation.id,
            reserved_uom_qty: false,
            qty_done: 0,
            picking_id: this.params.id,
        });
    }

    _getFieldToWrite() {
        return [
            'location_id',
            'location_dest_id',
            'lot_id',
            'lot_name',
            'package_id',
            'owner_id',
            'qty_done',
            'result_package_id',
        ];
    }

    _getSaveCommand() {
        const commands = this._getSaveLineCommand();
        if (commands.length) {
            return {
                route: '/stock_barcode/save_barcode_data',
                params: {
                    model: this.params.model,
                    res_id: this.params.id,
                    write_field: 'move_line_ids',
                    write_vals: commands,
                },
            };
        }
        return {};
    }

    _groupSublines(sublines, ids, virtual_ids, qtyDemand, qtyDone) {
        return Object.assign(super._groupSublines(...arguments), {
            reserved_uom_qty: qtyDemand,
            qty_done: qtyDone,
        });
    }

    _incrementTrackedLine() {
        return !(this.record.use_create_lots || this.record.use_existing_lots);
    }

    _lineIsComplete(line) {
        let isComplete = line.reserved_uom_qty && line.qty_done >= line.reserved_uom_qty;
        if (line.isPackageLine && !line.reserved_uom_qty && line.qty_done) {
            return true; // For package line, considers an unreserved package as a completed line.
        }
        if (!isComplete && line.lines) { // Grouped lines/package lines have multiple sublines.
            for (const subline of line.lines) {
                // For tracked product, a line with `qty_done` but no tracking number is considered as not complete.
                if (subline.product_id.tracking != 'none') {
                    if (subline.qty_done && !(subline.lot_id || subline.lot_name)) {
                        return false;
                    }
                } else if (subline.reserved_uom_qty && subline.qty_done < subline.reserved_uom_qty) {
                    return false;
                }
            }
        }
        return isComplete;
    }

    _lineIsNotComplete(line) {
        const isNotComplete = line.reserved_uom_qty && line.qty_done < line.reserved_uom_qty;
        if (!isNotComplete && line.lines) { // Grouped lines/package lines have multiple sublines.
            for (const subline of line.lines) {
                // For tracked product, a line with `qty_done` but no tracking number is considered as not complete.
                if (subline.product_id.tracking != 'none') {
                    if (subline.qty_done && !(subline.lot_id || subline.lot_name)) {
                        return true;
                    }
                } else if (subline.reserved_uom_qty && subline.qty_done < subline.reserved_uom_qty) {
                    return true;
                }
            }
        }
        return isNotComplete;
    }

    _lineNeedsToBePacked(line) {
        return Boolean(
            this.config.lines_need_to_be_packed && (line.qty_done && !line.result_package_id));
    }

    _moveEntirePackage() {
        return this.record.picking_type_entire_packs;
    }

    async _processLocation(barcodeData) {
        await super._processLocation(...arguments);
        if (barcodeData.destLocation) {
            await this._processLocationDestination(barcodeData);
            this.trigger('update');
        }
    }

    async _processLocationDestination(barcodeData) {
        if (this.config.restrict_scan_dest_location == 'no') {
            return;
        }
        this.highlightDestinationLocation = true;
        await this.changeDestinationLocation(barcodeData.destLocation.id, true);
        this.trigger('update');
        barcodeData.stopped = true;
    }

    async _processLocationSource(barcodeData) {
        await super._processLocationSource(...arguments);
        this.scannedSourceLocation = barcodeData.location;
    }

    async _processPackage(barcodeData) {
        const { packageName } = barcodeData;
        const recPackage = barcodeData.package;
        this.lastScannedPackage = false;
        if (barcodeData.packageType && !recPackage) {
            // Scanned a package type and no existing package: make a put in pack (forced package type).
            barcodeData.stopped = true;
            return await this._processPackageType(barcodeData);
        } else if (packageName && !recPackage) {
            // Scanned a non-existing package: make a put in pack.
            barcodeData.stopped = true;
            return await this._putInPack({ default_name: packageName });
        } else if (!recPackage || (
            recPackage.location_id && recPackage.location_id != this.currentLocationId
        )) {
            return; // No package, package's type or package's name => Nothing to do.
        }
        // If move entire package, checks if the scanned package matches a package line.
        if (this._moveEntirePackage()) {
            for (const packageLine of this.packageLines) {
                if (packageLine.package_id.name !== (packageName || recPackage.name)) {
                    continue;
                }
                barcodeData.stopped = true;
                if (packageLine.qty_done) {
                    this.lastScannedPackage = packageLine.package_id.id;
                    const message = _t("This package is already scanned.");
                    this.notification.add(message, { type: 'danger' });
                    return this.trigger('update');
                }
                for (const line of packageLine.lines) {
                    await this._updateLineQty(line, { qty_done: line.reserved_uom_qty });
                    this._markLineAsDirty(line);
                }
                return this.trigger('update');
            }
        }
        // Scanned a package: fetches package's quant and creates a line for
        // each of them, except if the package is already scanned.
        // TODO: can check if quants already in cache to avoid to make a RPC if
        // there is all in it (or make the RPC only on missing quants).
        const res = await this.orm.call(
            'stock.quant',
            'get_stock_barcode_data_records',
            [recPackage.quant_ids]
        );
        const quants = res.records['stock.quant'];
        if (!quants.length) { // Empty package => Assigns it to the last scanned line.
            const currentLine = this.selectedLine || this.lastScannedLine;
            if (currentLine && !currentLine.result_package_id) {
                await this._assignEmptyPackage(currentLine, recPackage);
                barcodeData.stopped = true;
                this.selectedLineVirtualId = false;
                this.lastScannedPackage = recPackage.id;
                this.trigger('update');
            }
            return;
        }
        this.cache.setCache(res.records);

        // Checks if the package is already scanned.
        let alreadyExisting = 0;
        for (const line of this.pageLines) {
            if (line.package_id && line.package_id.id === recPackage.id &&
                this.getQtyDone(line) > 0) {
                alreadyExisting++;
            }
        }
        if (alreadyExisting === quants.length) {
            barcodeData.error = _t("This package is already scanned.");
            return;
        }
        // For each quants, creates or increments a barcode line.
        for (const quant of quants) {
            const product = this.cache.getRecord('product.product', quant.product_id);
            const searchLineParams = Object.assign({}, barcodeData, { product });
            const currentLine = this._findLine(searchLineParams);
            if (currentLine) { // Updates an existing line.
                const fieldsParams = this._convertDataToFieldsParams({
                    quantity: quant.quantity,
                    lotName: barcodeData.lotName,
                    lot: barcodeData.lot,
                    package: recPackage,
                    owner: barcodeData.owner,
                });
                await this.updateLine(currentLine, fieldsParams);
            } else { // Creates a new line.
                const fieldsParams = this._convertDataToFieldsParams({
                    product,
                    quantity: quant.quantity,
                    lot: quant.lot_id,
                    package: quant.package_id,
                    resultPackage: quant.package_id,
                    owner: quant.owner_id,
                });
                await this._createNewLine({ fieldsParams });
            }
        }
        barcodeData.stopped = true;
        this.selectedLineVirtualId = false;
        this.lastScannedPackage = recPackage.id;
        this.trigger('update');
    }

    async _processPackageType(barcodeData) {
        const { packageType } = barcodeData;
        const line = this.selectedLine;
        if (!line || !line.qty_done) {
            barcodeData.stopped = true;
            const message = _t("You can't apply a package type. First, scan product or select a line");
            return this.notification.add(message, { type: 'warning' });
        }
        const resultPackage = line.result_package_id;
        if (!resultPackage) { // No package on the line => Do a put in pack.
            const additionalContext = { default_package_type_id: packageType.id };
            if (barcodeData.packageName) {
                additionalContext.default_name = barcodeData.packageName;
            }
            await this._putInPack(additionalContext);
        } else if (resultPackage.package_type_id.id !== packageType.id) {
            // Changes the package type for the scanned one.
            await this.save();
            await this.orm.write('stock.quant.package', [resultPackage.id], {
                package_type_id: packageType.id,
            });
            const message = sprintf(
                _t("Package type %s was correctly applied to the package %s"),
                packageType.name, resultPackage.name
            );
            this.notification.add(message, { type: 'success' });
            this.trigger('refresh');
        }
    }

    async _putInPack(additionalContext = {}) {
        const context = Object.assign({ barcode_view: true }, additionalContext);
        if (!this.groups.group_tracking_lot) {
            return this.notification.add(
                _t("To use packages, enable 'Packages' in the settings"),
                { type: 'danger'}
            );
        }
        await this.save();
        const result = await this.orm.call(
            this.params.model,
            'action_put_in_pack',
            [[this.params.id]],
            { context }
        );
        if (typeof result === 'object') {
            this.trigger('process-action', result);
        } else {
            this.trigger('refresh');
        }
    }

    _setLocationFromBarcode(result, location) {
        if (this.record.picking_type_code === 'outgoing') {
            result.location = location;
        } else if (this.record.picking_type_code === 'incoming') {
            result.destLocation = location;
        } else if (this.previousScannedLines.length) {
            if (this.config.restrict_scan_source_location && !this.scannedSourceLocation) {
                result.location = location;
            } else {
                result.destLocation = location;
            }
        } else {
            result.location = location;
        }
        return result;
    }

    _sortingMethod(l1, l2) {
        const l1IsCompleted = this._lineIsComplete(l1);
        const l2IsCompleted = this._lineIsComplete(l2);
        // Complete lines always on the bottom.
        if (!l1IsCompleted && l2IsCompleted) {
            return -1;
        } else if (l1IsCompleted && !l2IsCompleted) {
            return 1;
        }
        return super._sortingMethod(...arguments);
    }

    _updateLineQty(line, args) {
        if (line.product_id.tracking === 'serial' && line.qty_done > 0 && (this.record.use_create_lots || this.record.use_existing_lots)) {
            return;
        }
        if (args.qty_done) {
            if (args.uom) {
                // An UoM was passed alongside the quantity, needs to check it's
                // compatible with the product's UoM.
                const lineUOM = line.product_uom_id;
                if (args.uom.category_id !== lineUOM.category_id) {
                    // Not the same UoM's category -> Can't be converted.
                    const message = sprintf(
                        _t("Scanned quantity uses %s as Unit of Measure, but this UoM is not compatible with the line's one (%s)."),
                        args.uom.name, lineUOM.name
                    );
                    return this.notification.add(message, { title: _t("Wrong Unit of Measure"), type: 'danger' });
                } else if (args.uom.id !== lineUOM.id) {
                    // Compatible but not the same UoM => Need a conversion.
                    args.qty_done = (args.qty_done / args.uom.factor) * lineUOM.factor;
                    args.uom = lineUOM;
                }
            }
            line.qty_done += args.qty_done;
        }
    }

    _updateLotName(line, lotName) {
        line.lot_name = lotName;
    }

    async _processGs1Data(data) {
        const result = await super._processGs1Data(...arguments);
        const { rule } = data;
        if (result.location && (rule.type === 'location_dest' || this.messageType === 'scan_product_or_dest')) {
            result.destLocation = result.location;
            result.location = undefined;
        }
        return result;
    }
}
