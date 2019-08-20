odoo.define('accountReportsFollowup.FollowupFormController', function (require) {
"use strict";

var FollowupFormController = require('accountReports.FollowupFormController');

FollowupFormController.include({
    events: Object.assign({}, FollowupFormController.prototype.events, {
        'click .o_account_reports_followup_manual_action_button': '_onManualAction',
    }),

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @override
     * @private
     */
    _update: function () {
        this._updateButtons();
        return this._super.apply(this, arguments);
    },
    /**
     * Update the buttons according to followup_level.
     *
     * @private
     */
    _updateButtons: function () {
        let setButtonClass = (button, primary) => {
            /* Set class 'btn-primary' if parameter `primary` is true
             * 'btn-secondary' otherwise
             */
            let addedClass = primary ? 'btn-primary' : 'btn-secondary'
            let removedClass = !primary ? 'btn-secondary' : 'btn-primary'
            this.$buttons.find(`button.${button}`)
                .removeClass(removedClass).addClass(addedClass);
        }
        if (!this.$buttons) {
            return;
        }
        var followupLevel = this.model.get(this.handle).data.followup_level;
        setButtonClass('o_account_reports_followup_print_letter_button', followupLevel.print_letter)
        setButtonClass('o_account_reports_followup_send_mail_button', followupLevel.send_email)
        setButtonClass('o_account_reports_followup_send_sms_button', followupLevel.send_sms)
        if (followupLevel.manual_action) {
            this.$buttons.find('button.o_account_reports_followup_manual_action_button')
                .html(followupLevel.manual_action_note);
            setButtonClass('o_account_reports_followup_manual_action_button', !followupLevel.manual_action_done)
        } else {
            this.$buttons.find('button.o_account_reports_followup_manual_action_button').hide();
        }
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * When the user click on the manual action button, we need to update it
     * in the backend.
     *
     * @private
     */
    _onManualAction: function () {
        var self = this;
        var partnerID = this.model.get(this.handle).res_id;
        var followupLevel = this.model.get(this.handle).data.followup_level.id;
        var options = {
            partner_id: partnerID
        };
        this.model.doManualAction(this.handle);
        if (followupLevel) {
            options['followup_level'] = followupLevel;
        }
        this._rpc({
            model: 'account.followup.report',
            method: 'do_manual_action',
            args: [options]
        })
        .then(function () {
            self.renderer.chatter.trigger_up('reload_mail_fields', {
                activity: true,
                thread: true,
                followers: true
            });
            self._displayDone();
        });
    },
    /**
     * Print the customer statement.
     *
     * @private
     */
    _onPrintLetter: function () {
        this.model.doPrintLetter(this.handle);
        this._super.apply(this, arguments);
    },
    /**
     * Send the mail server-side.
     *
     * @private
     */
    _onSendMail: function () {
        this.model.doSendMail(this.handle);
        this._super.apply(this, arguments);
    },
    /**
     * Send the sms server-side.
     *
     * @override
     * @private
     */
    _onSendSMS() {
        this.model.doSendSMS(this.handle);
        this._super.apply(this, arguments);
    },
});
});