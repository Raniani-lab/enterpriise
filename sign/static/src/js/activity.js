odoo.define('sign.Activity', function (require) {
"use strict";

const field_registry = require('web.field_registry');
require('mail.Activity');
const KanbanActivity = field_registry.get('kanban_activity');

KanbanActivity.include({
    events: Object.assign({}, KanbanActivity.prototype.events, {
        'click .o_mark_as_done_request_sign': '_onClickRequestSign',
    }),

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickRequestSign(ev) {
        ev.preventDefault();
        this.do_action('sign.action_sign_send_request', {
            additional_context: {
                'sign_directly_without_mail': false,
                'default_activity_id': $(ev.currentTarget).data('activity-id'),
            },
            on_close: this._reload.bind(this, {activity: true, thread: true}),
        });
    }
});

});
