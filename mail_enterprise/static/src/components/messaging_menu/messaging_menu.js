odoo.define('mail_enterprise/static/src/components/messaging_menu/messaging_menu.js', function (require) {

const MessagingMenu = require('mail/static/src/components/messaging_menu/messaging_menu.js');

const { useBackButton } = require('web_mobile.hooks');

MessagingMenu.patch('mail_enterprise/static/src/components/chat_window/chat_window.js', T =>
    class extends T {

        /**
         * @override
         */
        _constructor() {
            super._constructor(...arguments);
            this._onBackButtonGlobal = this._onBackButtonGlobal.bind(this);
            useBackButton(this._onBackButtonGlobal, () => this.messagingMenu && this.messagingMenu.isOpen);
        }

        //--------------------------------------------------------------------------
        // Handlers
        //--------------------------------------------------------------------------

        /**
         * Handles the `backbutton` custom event. This event is triggered by the
         * mobile app when the back button of the device is pressed.
         *
         * @private
         * @param {CustomEvent} ev
         */
        _onBackButtonGlobal(ev) {
            if (!this.messagingMenu) {
                return;
            }
            this.messagingMenu.close();
        }

    }
);

});
