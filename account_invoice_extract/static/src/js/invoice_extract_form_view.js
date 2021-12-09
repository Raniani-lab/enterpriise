/** @odoo-module **/


import {AccountMoveFormView} from '@account/js/account_move_form';
import InvoiceExtractFormRenderer from '@account_invoice_extract/js/invoice_extract_form_renderer';
import view_registry from 'web.view_registry';


var AccountMoveFormViewExtract = AccountMoveFormView.extend({
    config: _.extend({}, AccountMoveFormView.prototype.config, {
        Renderer: InvoiceExtractFormRenderer,
    }),
});


view_registry.add('account_move_form', AccountMoveFormViewExtract);

export default AccountMoveFormViewExtract;
