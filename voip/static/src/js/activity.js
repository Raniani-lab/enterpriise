odoo.define('voip.Activity', function (require) {
"use strict";

const Activity = require('mail.Activity');

const { Component } = owl;

Activity.include({
    events: Object.assign({}, Activity.prototype.events, {
        'click .o_activity_voip_call': '_onClickVoipCall',
    }),

    /**
     * @override
     */
    init() {
        this._super(...arguments);
        Component.env.bus.on('voip_reload_chatter', this, () =>
            this._reload({
                activity: true,
                thread: true,
            })
        );
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickVoipCall(ev) {
        ev.preventDefault();
        this.trigger_up('voip_activity_call', {
            number: ev.currentTarget.text.trim(),
            activityId: $(ev.currentTarget).data('activity-id'),
        });
    }
});

});
