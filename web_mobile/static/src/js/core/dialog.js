odoo.define('web_mobile.Dialog', function (require) {
"use strict";

var Dialog = require('web.Dialog');
const config = require("web.config");
var mobileMixins = require('web_mobile.mixins');

Dialog.include(_.extend({}, mobileMixins.BackButtonEventMixin, {
    /**
     * Ensure that the on_attach_callback is called after the Dialog has been
     * attached to the DOM and opened.
     *
     * @override
     */
    init() {
        this._super(...arguments);
        this._opened = this._opened.then(this.on_attach_callback.bind(this));
    },
    /**
     * As the Dialog is based on Bootstrap's Modal we don't handle ourself when
     * the modal is detached from the DOM and we have to rely on their events
     * to call on_detach_callback.
     * The 'hidden.bs.modal' is triggered when the hidding animation (if any)
     * is finished and the modal is detached from the DOM.
     *
     * Also, get the current scroll position for mobile devices in order to
     * maintain offset while dialog is closed.
     *
     * @override
     */
    willStart: function () {
        var self = this;
        return this._super.apply(this, arguments).then(function () {
            self.$modal.on('hidden.bs.modal', self.on_detach_callback.bind(self));
            // need to get scrollPostion prior opening the dialog else body will scroll to
            // top due to fixed position applied on it with help of 'modal-open' class.
            if (config.device.isMobile) {
                self.scrollPosition = {
                    top: window.scrollY || document.documentElement.scrollTop,
                    left: window.scrollX || document.documentElement.scrollLeft,
                };
            }
        });
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Scroll to original position while closing modal in mobile devices
     *
     * @override
     */

    destroy() {
        if (config.device.isMobile && this.$modal && $('body > .modal').filter(':visible').length <= 1) {
            // in case of multiple open dialogs, only reset scroll while closing the last one
            // (it can be done only if there's no fixed position on body and thus by removing
            // 'modal-open' class responsible for fixed position)
            this.$modal.closest('body').removeClass('modal-open');
            window.scrollTo(this.scrollPosition);
        }
        this._super(...arguments);
    },
    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * Close the current dialog on 'backbutton' event.
     *
     * @private
     * @override
     * @param {Event} ev
     */
    _onBackButton: function () {
        this.close();
    },
}));

});

odoo.define('web_mobile.OwlDialog', function (require) {
"use strict";

const OwlDialog = require('web.OwlDialog');
const { useBackButton } = require('web_mobile.hooks');

OwlDialog.patch('web_mobile', T => class extends T {
    constructor() {
        super(...arguments);
        useBackButton(this._onBackButton.bind(this));
    }

    //---------------------------------------------------------------------
    // Handlers
    //---------------------------------------------------------------------

    /**
     * Close dialog on back-button
     * @private
     */
    _onBackButton() {
        this._close();
    }
});

});

odoo.define('web_mobile.Popover', function (require) {
"use strict";

const Popover = require('web.Popover');
const { useBackButton } = require('web_mobile.hooks');

Popover.patch('web_mobile', T => class extends T {
    constructor() {
        super(...arguments);
        useBackButton(this._onBackButton.bind(this), () => this.state.displayed);
    }

    //---------------------------------------------------------------------
    // Handlers
    //---------------------------------------------------------------------

    /**
     * Close popover on back-button
     * @private
     */
    _onBackButton() {
        this._close();
    }
});

});

odoo.define('web_mobile.ControlPanel', function (require) {
"use strict";

const { device } = require('web.config');

if (!device.isMobile) {
    return;
}

const ControlPanel = require('web.ControlPanel');
const { useBackButton } = require('web_mobile.hooks');

ControlPanel.patch('web_mobile', T => class extends T {
    constructor() {
        super(...arguments);
        useBackButton(this._onBackButton.bind(this), () => this.state.showMobileSearch);
    }

    //---------------------------------------------------------------------
    // Handlers
    //---------------------------------------------------------------------

    /**
     * close mobile search on back-button
     * @private
     */
    _onBackButton() {
        this._resetSearchState();
    }
});

});
