/* @odoo-module */

import { PhoneCallTab } from "@voip/legacy/phone_call_tab";
import { uniqueId } from "@web/core/utils/functions";

function cleanNumber(number) {
    if (!number) {
        return;
    }
    return number.replace(/[^0-9+]/g, "");
}

export const PhoneCallContactsTab = PhoneCallTab.extend({
    /**
     * @constructor
     */
    init() {
        this._super(...arguments);
        this._limit = 13;
        this._searchDomain = undefined;
    },
    /**
     * @override
     */
    start() {
        this._bindScroll();
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    _getSelectedPhoneCall() {
        if (!this._selectedPhoneCallId) {
            return undefined;
        }
        return this._phoneCalls.find((call) => call.partnerId === this._phoneCallDetails.partnerId);
    },
    /**
     * @override
     * @return {Promise}
     */
    async initPhoneCall() {
        const _super = this._super.bind(this, ...arguments); // limitation of class.js
        const currentPhoneCall = this._getCurrentPhoneCall();
        // if a state exists, a call was previously made so we use log it as created from a recent call
        let phoneCallData;
        if (currentPhoneCall.state) {
            phoneCallData = await this.env.services.orm.call(
                "voip.phonecall",
                "create_from_recent",
                [[currentPhoneCall.id]]
            );
        } else {
            phoneCallData = await this.env.services.orm.call(
                "voip.phonecall",
                "create_from_contact",
                [[currentPhoneCall.partnerId]]
            );
        }
        this._currentPhoneCallId = await this._displayInQueue(phoneCallData);
        await this._selectPhoneCall(this._currentPhoneCallId);
        return _super();
    },
    /**
     * @override
     */
    async refreshPhonecallsStatus() {
        this._offset = 0;
        this._isLazyLoadFinished = false;
        const contactsData = await this.env.services.orm.call("res.partner", "search_read", [], {
            domain: ["|", ["phone", "!=", false], ["mobile", "!=", false]],
            fields: ["avatar_128", "display_name", "email", "id", "mobile", "phone"],
            limit: this._limit,
        });
        return this._parseContactsData(contactsData);
    },
    /**
     * @override
     * @param {string} search
     * @return {Promise}
     */
    async searchPhoneCall(search) {
        if (search) {
            const number = cleanNumber(search);
            if (number.length > 2) {
                this._searchDomain = [
                    "|",
                    "|",
                    "|",
                    ["display_name", "ilike", search],
                    ["email", "ilike", search],
                    ["phone", "ilike", number],
                    ["mobile", "ilike", number],
                ];
            } else {
                this._searchDomain = [
                    "|",
                    ["display_name", "ilike", search],
                    ["email", "ilike", search],
                ];
            }
            this._offset = 0;
            this._isLazyLoadFinished = false;
            if (this._pendingRpc) {
                this._pendingRpc.abort();
            }
            const [voipIcon] = this.getParent().$(".o_dial_header_icon");
            voipIcon.classList.remove("oi", "oi-voip");
            voipIcon.classList.add("fa", "fa-spin", "fa-circle-o-notch");
            this._pendingRpc = this.env.services.orm.call(
                "res.partner",
                "search_read",
                [],
                {
                    domain: [
                        "|",
                        ["phone", "!=", false],
                        ["mobile", "!=", false],
                        ...this._searchDomain,
                    ],
                    fields: ["avatar_128", "display_name", "email", "id", "mobile", "phone"],
                    limit: this._limit,
                    offset: this._offset,
                },
                { shadow: true }
            );
            try {
                const contactsData = await this._pendingRpc;
                this._parseContactsData(contactsData);
                this._pendingRpc = null;
                voipIcon.classList.remove("fa", "fa-spin", "fa-circle-o-notch");
                voipIcon.classList.add("oi", "oi-voip");
            } catch (error) {
                if (error.event?.type === "abort") {
                    error.event.preventDefault();
                } else {
                    this._pendingRpc = null;
                    voipIcon.classList.remove("fa", "fa-spin", "fa-circle-o-notch");
                    voipIcon.classList.add("oi", "oi-voip");
                }
            }
        } else {
            this._searchDomain = false;
            this.refreshPhonecallsStatus();
        }
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Gets the next phonecalls to display with the current offset
     *
     * @private
     * @return {Promise}
     */
    async _lazyLoadPhonecalls() {
        this._isLazyLoading = true;
        const domain = ["|", ["phone", "!=", false], ["mobile", "!=", false]].concat(
            this._searchDomain || []
        );
        const contactsData = await this.env.services.orm.call("res.partner", "search_read", [], {
            domain,
            fields: ["avatar_128", "display_name", "email", "id", "mobile", "phone"],
            limit: this._limit,
            offset: this._offset,
        });
        if (contactsData.length < this._limit) {
            this._isLazyLoadFinished = true;
        }
        const phoneCallsData = this._makePhoneCallsDataFromContactsData(contactsData);
        const promises = phoneCallsData.map((phoneCallData) => this._displayInQueue(phoneCallData));
        await Promise.all(promises);
        this._computeScrollLimit();
        this._isLazyLoading = false;
    },
    /**
     * Since the contact tab is based on res_partner and not voip_phonecall,
     * this method make the convertion between the models.
     *
     * @private
     * @param {Object[]} contactsData
     * @return {Object[]}
     */
    _makePhoneCallsDataFromContactsData(contactsData) {
        return contactsData.map((contactData) => {
            return {
                id: uniqueId(`virtual_phone_call_id_${contactData.id}_`),
                isContact: true,
                mobile: contactData.mobile,
                partner_email: contactData.email,
                partner_id: contactData.id,
                partner_avatar_128: contactData.avatar_128,
                partner_name: contactData.display_name,
                phone: contactData.phone,
            };
        });
    },
    /**
     * Parses the contacts to convert them and then calls the _parsePhoneCalls.
     *
     * @private
     * @param {Object[]} contactsData
     * @return {Promise}
     */
    async _parseContactsData(contactsData) {
        this._computeScrollLimit();
        return this._parsePhoneCalls(this._makePhoneCallsDataFromContactsData(contactsData));
    },
});
