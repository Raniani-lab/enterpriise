odoo.define('voip.fields', function (require) {
"use strict";

var basic_fields = require('web.basic_fields');
var core = require('web.core');
var config = require('web.config');

var _t = core._t;

// As voip is not supported on mobile devices, we want to keep the standard phone widget
if (config.device.isMobile) {
    return;
}


/**
 * Override of FieldPhone to use the DialingPanel to perform calls on clicks.
 */
var Phone = basic_fields.FieldPhone;
Phone.include({
    events: _.extend({}, Phone.prototype.events, {
        'click': '_onClick',
    }),

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Uses the DialingPanel to perform the call.
     *
     * @private
     * @param {String} phoneNumber
     */
    _call: function (phoneNumber) {
        this.do_notify(_t('Start Calling'), _t('Calling ') + ' ' + phoneNumber);
        var params = {
            resModel: this.model,
            resId: this.res_id,
            number: phoneNumber,
        };
        this.trigger_up('voip_call', params);
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * Called when the phone number is clicked.
     *
     * @private
     * @param {MouseEvent} e
     */
    _onClick: function (e) {
        if (this.mode === 'readonly') {
            var pbxConfiguration;
            this.trigger_up('get_pbx_configuration', {
                callback: function (output) {
                    pbxConfiguration = output.pbxConfiguration;
                },
            });
            if (
                pbxConfiguration.mode !== 'prod' ||
                (
                    pbxConfiguration.pbx_ip &&
                    pbxConfiguration.wsServer &&
                    pbxConfiguration.login &&
                    pbxConfiguration.password
                )
            ) {
                e.preventDefault();
                var phoneNumber = this.value;
                this._call(phoneNumber);
            }
        }
    },
});

return {
};

});
