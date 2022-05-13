/** @odoo-module **/

import { bus } from 'web.core';
import LineTitleComponent from '@stock_barcode/components/line_title';
const { Component } = owl;

export default class LineComponent extends Component {
    get displayResultPackage() {
        return this.env.model.displayResultPackage;
    }

    get isComplete() {
        if (!this.qtyDemand || this.qtyDemand != this.qtyDone) {
            return false;
        } else if (this.isTracked && !this.lotName) {
            return false;
        }
        return true;
    }

    get isSelected() {
        return this.line.virtual_id === this.env.model.selectedLineVirtualId ||
        (this.line.package_id && this.line.package_id.id === this.env.model.lastScannedPackage);
    }

    get isTracked() {
        return this.line.product_id.tracking !== 'none';
    }

    get lotName() {
        return (this.line.lot_id && this.line.lot_id.name) || this.line.lot_name || '';
    }

    get nextExpected() {
        if (!this.isSelected) {
            return false;
        } else if (this.isTracked && !this.lotName) {
            return 'lot';
        } else if (this.qtyDemand && this.qtyDone < this.qtyDemand) {
            return 'quantity';
        }
    }

    get qtyDemand() {
        return this.env.model.getQtyDemand(this.line);
    }

    get qtyDone() {
        return this.env.model.getQtyDone(this.line);
    }

    get quantityIsSet() {
        return this.line.inventory_quantity_set;
    }

    get incrementQty() {
        return this.env.model.getIncrementQuantity(this.line);
    }

    get line() {
        return this.props.line;
    }

    get requireLotNumber() {
        return true;
    }

    get componentClasses() {
        return [
            this.isComplete ? 'o_line_completed' : 'o_line_not_completed',
            this.env.model.lineIsFaulty(this) ? 'o_faulty' : '',
            this.isSelected ? 'o_selected o_highlight' : ''
        ].join(' ');
    }

    edit() {
        bus.trigger('edit-line', { line: this.line });
    }

    addQuantity(quantity, ev) {
        this.env.model.updateLineQty(this.line.virtual_id, quantity);
    }

    select(ev) {
        this.env.model.selectLine(this.line);
        this.env.model.trigger('update');
    }

    setOnHandQuantity(ev) {
        this.env.model.setOnHandQuantity(this.line);
    }
}
LineComponent.template = 'stock_barcode.LineComponent';
LineComponent.components = {
    LineTitleComponent,
};
