/** @odoo-module **/

import { registerModel } from "@mail/model/model_core";
import { attr, one } from "@mail/model/model_field";
import { clear, insertAndReplace } from "@mail/model/model_field_command";

/**
 * Models the global state of the VoIP module.
 */
registerModel({
    name: "Voip",
    identifyingFields: ["messaging"],
    recordMethods: {
        /**
         * Remove whitespaces, dashes, slashes and periods from a phone number.
         * @param {string} phoneNumber
         * @returns {string}
         */
        cleanPhoneNumber(phoneNumber) {
            // U+00AD is the "soft hyphen" character
            return phoneNumber.replace(/[\s-/.\u00AD]/g, "");
        },
        /**
         * @returns {boolean|FieldCommand}
         */
        _computeAreCredentialsSet() {
            if (!this.messaging.currentUser || !this.messaging.currentUser.res_users_settings_id) {
                return clear();
            }
            return Boolean(
                this.messaging.currentUser.res_users_settings_id.voip_username &&
                this.messaging.currentUser.res_users_settings_id.voip_secret
            );
        },
        /**
         * @returns {string|FieldCommand}
         */
        _computeAuthorizationUsername() {
            if (!this.messaging.currentUser || !this.messaging.currentUser.res_users_settings_id) {
                return clear();
            }
            return this.messaging.currentUser.res_users_settings_id.voip_username;
        },
        /**
         * @returns {string|FieldCommand}
         */
        _computeCleanedExternalDeviceNumber() {
            if (!this.messaging.currentUser || !this.messaging.currentUser.res_users_settings_id) {
                return clear();
            }
            if (!this.messaging.currentUser.res_users_settings_id.external_device_number) {
                return clear();
            }
            return this.cleanPhoneNumber(
                this.messaging.currentUser.res_users_settings_id.external_device_number
            );
        },
        /**
         * @returns {boolean|FieldCommand}
         */
        _computeWillCallFromAnotherDevice() {
            if (!this.messaging.currentUser || !this.messaging.currentUser.res_users_settings_id) {
                return clear();
            }
            return (
                this.messaging.currentUser.res_users_settings_id.should_call_from_another_device &&
                this.cleanedExternalDeviceNumber !== ""
            );
        },
    },
    fields: {
        /**
         * Determines if `voip_secret` and `voip_username` settings are defined
         * for the current user.
         */
        areCredentialsSet: attr({
            compute: "_computeAreCredentialsSet",
            default: false,
        }),
        /**
         * With some providers, the authorization username (the one used to
         * register with the PBX server) differs from the username.
         */
        authorizationUsername: attr({
            compute: "_computeAuthorizationUsername",
            default: "",
        }),
        /**
         * Notes: this is a bit strange having to clean a string retrieved from
         * the server.
         */
        cleanedExternalDeviceNumber: attr({
            compute: "_computeCleanedExternalDeviceNumber",
            default: "",
        }),
        /**
         * Either 'demo' or 'prod'. In demo mode, phone calls are simulated in
         * the interface but no RTC sessions are actually established.
         */
        mode: attr(),
        /**
         * The address of the PBX server.
         *
         * This is used as the hostname in SIP URIs.
         */
        pbxAddress: attr(),
        ringtoneRegistry: one("RingtoneRegistry", {
            default: insertAndReplace(),
            inverse: "voip",
            isCausal: true,
        }),
        /**
         * The WebSocket URL of the signaling server that will be used to
         * communicate SIP messages between Odoo and the PBX server.
         */
        webSocketUrl: attr(),
        /**
         * Determines if the `should_call_from_another_device` setting is set
         * and if an `external_device_number` has been provided.
         */
        willCallFromAnotherDevice: attr({
            compute: "_computeWillCallFromAnotherDevice",
            default: false,
        }),
    },
});
