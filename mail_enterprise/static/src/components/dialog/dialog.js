odoo.define('mail_enterprise/static/src/components/dialog/dialog.js', function (require) {

const Dialog = require('mail/static/src/components/dialog/dialog.js');
const { useBackButton } = require('web_mobile.hooks');

Dialog.patch('mail_enterprise/static/src/components/dialog/dialog.js', T =>
    class extends T {

        /**
         * @override
         */
        _constructor() {
            super._constructor(...arguments);
            this._onBackButtonGlobal = this._onBackButtonGlobal.bind(this);
            this._backButtonHandler = useBackButton(this._onBackButtonGlobal);
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
            if (!this.dialog) {
                return;
            }
            this.dialog.delete();
        }

    }
);

});
