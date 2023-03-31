/** @odoo-module **/

import Popover from "web.Popover";
import { useBackButton } from "web_mobile.hooks";
import { patch } from "web.utils";

patch(Popover.prototype, "web_mobile", {
    setup() {
        this._super(...arguments);
        useBackButton(this._onBackButton.bind(this), () => this.state.displayed);
    },

    //---------------------------------------------------------------------
    // Handlers
    //---------------------------------------------------------------------

    /**
     * Close popover on back-button
     * @private
     */
    _onBackButton() {
        this._close();
    },
});
