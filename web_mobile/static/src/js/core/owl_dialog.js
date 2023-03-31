/** @odoo-module **/

import OwlDialog from "web.OwlDialog";
import { useBackButton } from "web_mobile.hooks";
import { patch } from "web.utils";

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
