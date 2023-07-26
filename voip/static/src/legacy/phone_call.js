/* @odoo-module */

import Widget from "@web/legacy/js/core/widget";

export const PhoneCall = Widget.extend({
    template: "voip.PhoneCall",
    events: {
        click: "_onClick",
        "click .o_dial_remove_phonecall": "_onClickRemovePhoneCall",
    },
    /**
     * @override
     * @param {import("@voip/legacy/phone_call_tab").PhoneCallTab} parent
     * @param {Object} param1
     * @param {integer} param1.activity_id
     * @param {string} param1.activity_model_name
     * @param {integer} param1.activity_res_id
     * @param {string} param1.activity_res_model
     * @param {string} param1.activity_summary
     * @param {integer} [param1.callTries=0]
     * @param {string} param1.call_date
     * @param {integer} param1.duration
     * @param {integer} param1.id
     * @param {boolean} param1.isContact
     * @param {boolean} param1.isRecent
     * @param {string} param1.mobile
     * @param {string} param1.name
     * @param {string} param1.partner_email
     * @param {integer} param1.partner_id
     * @param {string} param1.partner_avatar_128
     * @param {string} [param1.partner_name]
     * @param {string} param1.phone
     * @param {string} param1.state ['cancel', 'done', 'open', 'pending']
     */
    init(
        parent,
        {
            activity_id,
            activity_model_name,
            activity_res_id,
            activity_res_model,
            activity_summary,
            callTries = 0,
            call_date,
            duration,
            id,
            isContact,
            isRecent,
            mobile,
            name,
            partner_email,
            partner_id,
            partner_avatar_128,
            partner_name,
            phone,
            state,
        }
    ) {
        this._super(...arguments);

        this.activityId = activity_id;
        this.activityModelName = activity_model_name;
        this.activityResId = activity_res_id;
        this.activityResModel = activity_res_model;
        this.callTries = callTries;
        this.date = call_date;
        this.email = partner_email;
        this.id = id;
        this.imageSmall = partner_avatar_128;
        this.isContact = isContact;
        this.isRecent = isRecent;
        this.env = parent.env;
        this.minutes = Math.floor(duration).toString();
        this.mobileNumber = mobile;
        this.name = name;
        this.partnerId = partner_id;
        this.partnerName = partner_name;
        this.phoneNumber = phone;
        this.seconds = ((duration % 1) * 60).toFixed();
        this.state = state;
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Makes rpc to log the hangup call.
     *
     * @param {Object} param0 contains the duration of the call and if the call
     *   is finished
     * @param {integer} param0.durationSeconds
     * @param {boolean} param0.isDone
     * @return {Promise}
     */
    async hangUp({ durationSeconds, isDone }) {
        if (this.id === undefined) {
            console.warn("phonecall has no id!");
        } else {
            await this.env.services.orm.call("voip.phonecall", "hangup_call", [this.id], {
                done: isDone,
                duration_seconds: durationSeconds,
            });
        }
        this.env.services.voip.bus.trigger("voip-reload-chatter");
    },
    /**
     * Makes rpc to set the call as canceled.
     *
     * @return {Promise}
     */
    async markPhonecallAsCanceled() {
        if (this.id === undefined) {
            console.warn("phonecall has no id!");
            return;
        }
        await this.env.services.orm.call("voip.phonecall", "canceled_call", [this.id]);
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _onClick() {
        this.getParent().selectPhoneCall(this.id);
    },
    /**
     * @private
     *
     * @param {MouseEvent} ev
     */
    _onClickRemovePhoneCall(ev) {
        ev.stopPropagation();
        ev.preventDefault();
        this.getParent().removePhoneCall(this.id);
    },
});
