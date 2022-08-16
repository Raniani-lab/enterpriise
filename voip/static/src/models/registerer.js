/** @odoo-module **/

import { registerModel } from "@mail/model/model_core";
import { attr, one } from "@mail/model/model_field";
import { clear } from "@mail/model/model_field_command";
import { OnChange } from "@mail/model/model_onchange";

import { sprintf } from "@web/core/utils/strings";
import { Markup } from "web.utils";

/**
 * Manages the registration to the Registrar (necessary to make the user
 * reachable).
 */
registerModel({
    name: "Registerer",
    lifecycleHooks: {
        _created() {
            const sipJsRegisterer = new window.SIP.Registerer(this.userAgent.__sipJsUserAgent, { expires: 3600 });
            sipJsRegisterer.stateChange.addListener((state) => this.update({ state }));
            this.update({ __sipJsRegisterer: sipJsRegisterer });
        },
        _willDelete() {
            this.__sipJsRegisterer.dispose();
        },
    },
    recordMethods: {
        /**
         * Sends the REGISTER request to the Registrar.
         */
        register() {
            this.__sipJsRegisterer.register({
                requestDelegate: {
                    onReject: (response) => this._onRegistrationRejected(response),
                },
            });
        },
        /**
         * Notes: only used to retrieve the initial state of the SIP.js
         * Registerer.
         *
         * @returns {SIP.RegistererState|FieldCommand}
         */
        _computeState() {
            if (!this.__sipJsRegisterer) {
                return clear();
            }
            return this.__sipJsRegisterer.state;
        },
        _onChangeState() {
            if (this.state === window.SIP.RegistererState.Registered) {
                this.messaging.messagingBus.trigger("sip_error_resolved");
            }
        },
        /**
         * Triggered when receiving a response with status code 4xx, 5xx, or 6xx
         * to the REGISTER request.
         *
         * @param {SIP.IncomingResponse} response The server final response to
         * the REGISTER request.
         */
        _onRegistrationRejected(response) {
            const errorMessage = sprintf(
                this.env._t("Registration rejected: %(statusCode)s %(reasonPhrase)s."),
                {
                    statusCode: response.message.statusCode,
                    reasonPhrase: response.message.reasonPhrase,
                },
            );
            const help = (() => {
                switch (response.message.statusCode) {
                    case 401: // Unauthorized
                        return this.env._t("The server failed to authenticate you. Please have an administrator verify that you are reaching the right server (PBX server IP in the General Settings) and that the credentials in your user preferences are correct.");
                    case 503: // Service Unavailable
                        return this.env._t("The error may come from the transport layer. Please have an administrator verify the websocket server URL in the General Settings. If the problem persists, this is probably an issue with the server.");
                    default:
                        return this.env._t("Please try again later. If the problem persists, you may want to ask an administrator to check the configuration.");
                }
            })();
            this.messaging.voip.triggerError(Markup`${errorMessage}</br></br>${help}`);
        },
    },
    fields: {
        /**
         * Possible values:
         * - SIP.RegistererState.Initial
         * - SIP.RegistererState.Registered
         * - SIP.RegistererState.Unregistered
         * - SIP.RegistererState.Terminated
         */
        state: attr({
            compute: "_computeState",
        }),
        userAgent: one("UserAgent", {
            identifying: true,
            inverse: "registerer",
            readonly: true,
            required: true,
        }),
        /**
         * An instance of the Registerer class from the SIP.js library. It
         * shouldn't be used outside of this model; only the Registerer model is
         * responsible for interfacing with this object.
         */
        __sipJsRegisterer: attr(),
    },
    onChanges: [
        new OnChange({
            dependencies: ["state"],
            methodName: '_onChangeState',
        }),
    ],
});
