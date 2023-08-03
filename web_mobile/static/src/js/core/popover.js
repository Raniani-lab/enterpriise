/** @odoo-module **/

import Popover from "@web/legacy/js/core/popover";
import { useBackButton } from "@web_mobile/js/core/hooks";
import { patch } from "@web/core/utils/patch";

patch(Popover.prototype, {
    setup() {
        super.setup(...arguments);
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
