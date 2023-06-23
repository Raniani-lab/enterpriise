/** @odoo-module **/

import Popover from "@web/legacy/js/core/popover";
import { useBackButton } from "@web_mobile/js/core/hooks";
import utils from "@web/legacy/js/core/utils";

utils.patch(Popover.prototype, "web_mobile", {
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
