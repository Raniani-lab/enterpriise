/** @odoo-module **/

export default class LineComponent extends owl.Component {
    mounted() {
        document.addEventListener('keydown', this._onKeyDown.bind(this));
        document.addEventListener('keyup', this._onKeyUp.bind(this));
    }

    willUnmount() {
        document.removeEventListener('keydown', this._onKeyDown.bind(this));
        document.removeEventListener('keyup', this._onKeyUp.bind(this));
    }

    get displayIncrementBtn() {
        return this.env.model.getDisplayIncrementBtn(this.line);
    }

    get displayDecrementBtn() {
        return this.env.model.getDisplayDecrementBtn(this.line);
    }

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

    get isFaulty() {
        return this.qtyDemand < this.qtyDone;
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

    get decrementQty() {
        return this.shiftPressed && this.qtyDemand ? this.qtyDone : 1;
    }

    get incrementQty() {
        return this.shiftPressed && this.qtyDemand ? this.qtyDemand - this.qtyDone : 1;
    }

    get line() {
        return this.props.line;
    }

    get requireLotNumber() {
        return true;
    }

    edit() {
        this.trigger('edit-line', { line: this.line });
    }

    addQuantity(quantity, ev) {
        this.env.model.updateLineQty(this.line.virtual_id, quantity);
    }

    select(ev) {
        ev.stopPropagation();
        this.env.model.selectLine(this.line);
        this.env.model.trigger('update');
    }

    // -------------------------------------------------------------------------
    // Handlers
    // -------------------------------------------------------------------------

    _onKeyDown(ev) {
        if (ev.key === 'Shift') {
            ev.stopPropagation();
            this.shiftPressed = true;
            this.env.model.trigger('update');
        }
    }

    _onKeyUp(ev) {
        if (ev.key === 'Shift') {
            ev.stopPropagation();
            this.shiftPressed = false;
            this.env.model.trigger('update');
        }
    }
}
LineComponent.template = 'stock_barcode.LineComponent';
