odoo.define('mail_enterprise/static/src/components/chat_window/chat_window.js', function (require) {

const ChatWindow = require('@mail/components/chat_window/chat_window')[Symbol.for("default")];

const { useBackButton } = require('web_mobile.hooks');
const { patch } = require('web.utils');

patch(ChatWindow.prototype, 'mail_enterprise/static/src/components/chat_window/chat_window.js', {
    /**
     * @override
     */
    _constructor() {
        this._super(...arguments);
        this._onBackButtonGlobal = this._onBackButtonGlobal.bind(this);
        useBackButton(this._onBackButtonGlobal);
    },

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
        if (!this.chatWindow) {
            return;
        }
        this.chatWindow.close();
    },
});

});
