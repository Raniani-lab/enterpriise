/** @odoo-module **/

import OwlDialog from "@web/legacy/js/core/owl_dialog";
import { useBackButton } from "@web_mobile/js/core/hooks";
import { patch } from '@web/legacy/js/core/utils';

patch(OwlDialog.prototype, "web_mobile", {
    setup() {
        this._super(...arguments);
        useBackButton(this._onBackButton.bind(this));
    },

    //---------------------------------------------------------------------
    // Handlers
    //---------------------------------------------------------------------

    /**
     * Close dialog on back-button
     * @private
     */
    _onBackButton() {
        this._close();
    },
});
