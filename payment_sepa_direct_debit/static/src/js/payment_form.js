/** @odoo-module **/

import { _t } from '@web/core/l10n/translation';
import checkoutForm from '@payment/js/checkout_form';
import manageForm from '@payment/js/manage_form';

const sepaDirectDebitMixin = {

    /**
     * Prepare the inline form of SEPA for direct payment.
     *
     * @override method from payment.payment_form_mixin
     * @private
     * @param {string} code - The code of the selected payment option's provider
     * @param {number} paymentOptionId - The id of the selected payment option
     * @param {string} flow - The online payment flow of the selected payment option
     * @return {void}
     */
    _prepareInlineForm: function (code, paymentOptionId, flow) {
        if (code !== 'sepa_direct_debit') {
            this._super(...arguments);
            return;
        } else if (flow === 'token') {
            return; // Don't show the form for tokens.
        }
        this._setPaymentFlow('direct');
    },

    /**
     * Verify the validity of the IBAN input before trying to process a payment.
     *
     * @override method from payment.payment_form_mixin
     * @private
     * @param {string} code - The code of the payment option provider.
     * @param {number} paymentOptionId - The id of the payment option handling the transaction.
     * @param {string} flow - The online payment flow of the transaction.
     * @return {void}
     */
    _processPayment: function (code, paymentOptionId, flow) {
        if (code !== 'sepa_direct_debit' || flow === 'token') {
            this._super(...arguments); // Tokens are handled by the generic flow.
            return;
        }

        const ibanInput = document.getElementById(`o_sdd_iban_${paymentOptionId}`);
        if (!ibanInput.reportValidity()) {
            this._enableButton(); // The submit button is disabled at this point, enable it
            this.call('ui', 'unblock'); // The page is blocked at this point, unblock it
            return; // Let the browser request to fill out required fields
        }

        this._super(...arguments);
    },

    /**
     * Link the IBAN to the transaction as an inactive mandate.
     *
     * @override method from payment.payment_form_mixin
     * @private
     * @param {string} code - The code of the provider.
     * @param {number} providerId - The id of the provider handling the transaction.
     * @param {object} processingValues - The processing values of the transaction.
     * @return {void}
     */
    _processDirectPayment: function (code, providerId, processingValues) {
        if (code !== 'sepa_direct_debit') {
            this._super(...arguments);
            return;
        }

        // Assign the SDD mandate corresponding to the IBAN to the transaction.
        const ibanInput = document.getElementById(`o_sdd_iban_${providerId}`);
        this._rpc({
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
