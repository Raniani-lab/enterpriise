/** @odoo-module **/

import core from "web.core";
import checkoutForm from "payment.checkout_form";
import manageForm from "payment.manage_form";

const _t = core._t;

const sepaDirectDebitMixin = {

    /**
     * Prepare the inline form of SEPA for direct payment.
     *
     * @override method from payment.payment_form_mixin
     * @private
     * @param {string} code - The code of the selected payment option's provider
     * @param {number} paymentOptionId - The id of the selected payment option
     * @param {string} flow - The online payment flow of the selected payment option
     * @return {Promise}
     */
    _prepareInlineForm: function (code, paymentOptionId, flow) {
        if (code !== 'sepa_direct_debit') {
            return this._super(...arguments);
        } else if (flow === 'token') {
            return Promise.resolve(); // Don't show the form for tokens
        }
        this._setPaymentFlow('direct');
        return Promise.resolve();
    },

    /**
     * Verify the validity of the iban input before trying to process a payment.
     *
     * @override method from payment.payment_form_mixin
     * @private
     * @param {string} code - The code of the payment option provider
     * @param {number} paymentOptionId - The id of the payment option handling the transaction
     * @param {string} flow - The online payment flow of the transaction
     * @return {Promise}
     */
    _processPayment: function (code, paymentOptionId, flow) {
        if (code !== 'sepa_direct_debit' || flow === 'token') {
            return this._super(...arguments); // Tokens are handled by the generic flow
        }

        const ibanInput = document.getElementById(`o_sdd_iban_${paymentOptionId}`);
        if (!ibanInput.reportValidity()) {
            this._enableButton(); // The submit button is disabled at this point, enable it
            $('body').unblock(); // The page is blocked at this point, unblock it
            return Promise.resolve(); // Let the browser request to fill out required fields
        }

        return this._super(...arguments);
    },

    /**
     * Link the iban to the transaction as an inactive mandate.
     *
     * @override method from payment.payment_form_mixin
     * @private
     * @param {string} code - The code of the provider.
     * @param {number} providerId - The id of the provider handling the transaction.
     * @param {object} processingValues - The processing values of the transaction;
     * @return {Promise}
     */
    _processDirectPayment: function (code, providerId, processingValues) {
        if (code !== 'sepa_direct_debit') {
            return this._super(...arguments);
        }

        // Assign the SDD mandate corresponding to the IBAN to the transaction.
        const ibanInput = document.getElementById(`o_sdd_iban_${providerId}`);
        return this._rpc({
            route: '/payment/sepa_direct_debit/set_mandate',
            params: {
                'reference': processingValues.reference,
                'iban': ibanInput.value,
                'access_token': processingValues.access_token,
            },
        }).then(() => {
            window.location = '/payment/status';
        }).guardedCatch((error) => {
            error.event.preventDefault();
            this._displayError(
                _t("Server Error"),
                _t("We are not able to process your payment."),
                error.message.data.message,
            );
        });
    },
};

checkoutForm.include(sepaDirectDebitMixin);
manageForm.include(sepaDirectDebitMixin);
