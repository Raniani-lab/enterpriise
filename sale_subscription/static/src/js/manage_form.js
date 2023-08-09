/** @odoo-module **/

    import { ConfirmationDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
    import { _t } from "@web/core/l10n/translation";
    import { renderToMarkup } from "@web/core/utils/render";

    import manageForm from "@payment/js/manage_form";

    manageForm.include({
        /**
         * Build the confirmation dialog based on the linked records' information.
         *
         * @override method from @payment/js/manage_form
         * @private
         * @param {Array} linkedRecordsInfo - The list of information about linked records.
         * @param confirmCallback - The original callback method called when the user clicks on the
                                    confirmation button.
         * @return {object}
         */
        _openConfirmationDialog: function (linkedRecordsInfo, confirmCallback) {
            if (!(linkedRecordsInfo.some(function(e) { return e.active_subscription; }))) {
                this._super(...arguments);
                return;
            }
            const body = renderToMarkup(
                "sale_subscription.ManageFormConfirmationDialog",
                { linkedRecordsInfo }
            );
            this.call("dialog", "add", ConfirmationDialog, {
                title: _t("Warning!"),
                body,
                cancel: () => {},
            });
        },
    });
