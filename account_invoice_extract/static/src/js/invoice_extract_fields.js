odoo.define('account_invoice_extract.Fields', function (require) {
"use strict";

var InvoiceExtractField = require('account_invoice_extract.Field');

var Class = require('web.Class');
var Mixins = require('web.mixins');

/**
 * This class groups the fields that are supported by the OCR. Also, it manages
 * the 'active' status of the fields, so that there is only one active field at
 * any given time.
 */
var InvoiceExtractFields = Class.extend(Mixins.EventDispatcherMixin, {
    custom_events: {
        active_invoice_extract_field: '_onActiveInvoiceExtractField',
    },
    /**
     * @override
     * @param {Class} parent a class with EventDispatcherMixin
     */
    init: function (parent) {
        Mixins.EventDispatcherMixin.init.call(this, arguments);
        this.setParent(parent);

        this._fields = [
            new InvoiceExtractField(this, { text: 'VAT', fieldName: 'VAT_Number' }),
            new InvoiceExtractField(this, { text: 'Vendor', fieldName: 'supplier' }),
            new InvoiceExtractField(this, { text: 'Currency', fieldName: 'currency' }),
            new InvoiceExtractField(this, { text: 'Total', fieldName: 'total' }),
            new InvoiceExtractField(this, { text: 'Date', fieldName: 'date' }),
            new InvoiceExtractField(this, { text: 'Due Date', fieldName: 'due_date' }),
            new InvoiceExtractField(this, { text: 'Vendor Reference', fieldName: 'invoice_id' }),
        ];

        this._fields[0].setActive();
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * There should always be an active field at any time
     *
     * @returns {account_invoice_extract.Field}
     */
    getActiveField: function () {
        return _.find(this._fields, function (field) {
            return field.isActive();
        });
    },
    /**
     * Get the field with the given 'name'. If no field name is provided,
     * gets the active field.
     *
     * @param {Object} [params={}]
     * @param {string} [params.name] the field name
     * @returns {account_invoice_extract.Field|undefined} returns undefined if
     *   the provided field name does not exist.
     */
    getField: function (params) {
        params = params || {};
        if (!params.name) {
            return this.getActiveField();
        }
        return _.find(this._fields, function (field) {
            return field.getName() === params.name;
        });
    },
    /**
     * Render the buttons for each fields.
     *
     * @param {Object} params
     * @param {$.Element} params.$container jQuery element with a single node
     *   in the DOM, which is the container of the field buttons.
     */
    renderButtons: function (params) {
        _.each(this._fields, function (field) {
            field.renderButton(params);
        });
    },
    /**
     * Reset the active state of fields, so that the 1st field is active.
     */
    resetActive: function () {
        var oldActiveField = this.getActiveField();
        oldActiveField.setInactive();
        this._fields[0].setActive();
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * Called when a field is selected (e.g. by clicking on the corresponding
     * button). This field becomes active, and other fields become inactive.
     *
     * @private
     * @param {OdooEvent} ev
     * @param {string} ev.data.fieldName
     */
    _onActiveInvoiceExtractField: function (ev) {
        var oldActiveField = this.getActiveField();
        oldActiveField.setInactive();
        var field = this.getField({ name: ev.data.fieldName });
        if (!field) {
            return;
        }
        field.setActive();
    },
});

return InvoiceExtractFields;

});
