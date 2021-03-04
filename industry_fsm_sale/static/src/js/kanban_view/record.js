odoo.define('industry_fsm_sale.ProductKanbanRecord', function (require) {
"use strict";

const KanbanRecord = require('web.KanbanRecord');

return KanbanRecord.extend({
    events: _.extend({}, KanbanRecord.prototype.events, {
        'click': '_onKanbanRecordClicked',
    }),

    /**
     * Kanban record click listener
     *
     * When the user clicks on the kanban record, we should add an unit to the product quantity.
     *
     * @param {Event} e
     */
    _onKanbanRecordClicked: function (e) {
        e.stopPropagation();
        if (this.subWidgets && this.subWidgets.hasOwnProperty('fsm_quantity') && !this.state.context.hide_qty_buttons) {
            const fsmQuantityWidget = this.subWidgets.fsm_quantity;
            if (fsmQuantityWidget.mode === 'readonly' && !fsmQuantityWidget.exitEditMode) {
                fsmQuantityWidget._addQuantity(new Event('click'));
            }
        }
    },

    /**
     * @override
     * @private
     * @returns {string} the url of the image
     */
    _getImageURL: function () {
        if (!this.imageURL) {
            this.imageURL = this._super.apply(this, arguments);
        }
        return this.imageURL;
    },
});

});
