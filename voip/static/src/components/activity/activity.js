odoo.define('voip/static/src/components/activity/activity.js', function (require) {
'use strict';

const { Activity } = require('@mail/components/activity/activity');

const { patch } = require('web.utils');

const components = { Activity };

patch(components.Activity.prototype, 'voip/static/src/components/activity/activity.js', {
    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickVoipCall(ev) {
        ev.preventDefault();
        this.trigger('voip_activity_call', {
            activityId: this.activity.id,
            number: this.activity.phone,
        });
    },
});

});
