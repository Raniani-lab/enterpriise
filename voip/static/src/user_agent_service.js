/* @odoo-module */

import { Registerer } from "@voip/js/registerer";

import { loadBundle } from "@web/core/assets";
import { browser } from "@web/core/browser/browser";
import { _t } from "@web/core/l10n/translation";

export class UserAgent {
    legacyUserAgent;
    registerer;
    voip;
    __sipJsUserAgent;

    constructor(env, services) {
        this.env = env;
        this.ringtoneService = services.ringtone;
        this.voip = services.voip;
    }

    /**
     * Provides the function that will be used by the SIP.js library to create
     * the media source that will serve as the local media stream (i.e. the
     * recording of the user's microphone).
     *
     * @returns {SIP.MediaStreamFactory}
     */
    get mediaStreamFactory() {
        return (constraints, sessionDescriptionHandler) => {
            const mediaRequest = browser.navigator.mediaDevices.getUserMedia(constraints);
            mediaRequest.then(
                (stream) => this.legacyUserAgent._onGetUserMediaSuccess(stream),
                (error) => this.legacyUserAgent._onGetUserMediaFailure(error)
            );
            return mediaRequest;
        };
    }

    /**
     * @returns {Object}
     */
    get sipJsUserAgentConfig() {
        const isDebug = odoo.debug !== "";
        return {
            authorizationPassword: this.voip.settings.voip_secret,
            authorizationUsername: this.voip.authorizationUsername,
            delegate: {
                onDisconnect: (error) => this._onDisconnect(error),
                onInvite: (inviteSession) => this.legacyUserAgent._onInvite(inviteSession),
            },
            hackIpInContact: true,
            logBuiltinEnabled: isDebug,
            logLevel: isDebug ? "debug" : "error",
            sessionDescriptionHandlerFactory:
                window.SIP.Web.defaultSessionDescriptionHandlerFactory(this.mediaStreamFactory),
            sessionDescriptionHandlerFactoryOptions: { iceGatheringTimeout: 1000 },
            transportOptions: {
                server: this.voip.webSocketUrl,
                traceSip: isDebug,
            },
            uri: window.SIP.UserAgent.makeURI(
                `sip:${this.voip.settings.voip_username}@${this.voip.pbxAddress}`
            ),
        };
    }

    async init(legacyUserAgent) {
        this.legacyUserAgent = legacyUserAgent;
        if (this.voip.mode !== "prod") {
            return;
        }
        if (!this.voip.hasRtcSupport) {
            this.voip.triggerError(
                _t(
                    "Your browser does not support some of the features needed for VoIP to work. Please try to update your browser or use a different one."
                )
            );
            return;
        }
        if (!this.voip.isServerConfigured) {
            this.voip.triggerError(
                _t("PBX or Websocket address is missing. Please check your settings.")
            );
            return;
        }
        if (!this.voip.areCredentialsSet) {
            this.voip.triggerError(
                _t("Your credentials are not correctly set. Please contact your administrator.")
            );
            return;
        }
        try {
            await loadBundle("voip.assets_sip");
        } catch (error) {
            console.error(error);
            this.voip.triggerError(
                _t("Failed to load the SIP.js library:</br></br> %(error message)s", {
                    "error message": error.message,
                })
            );
            return;
        }
        try {
            this.__sipJsUserAgent = new window.SIP.UserAgent(this.sipJsUserAgentConfig);
        } catch (error) {
            console.error(error);
            this.voip.triggerError(
                _t(
                    "An error occurred during the instantiation of the User Agent:</br></br> %(error message)s",
                    { "error message": error.message }
                )
            );
            return;
        }
        this.voip.triggerError(_t("Connecting…"));
        try {
            await this.__sipJsUserAgent.start();
        } catch {
            this.voip.triggerError(
                _t(
                    "Failed to start the user agent. The URL of the websocket server may be wrong. Please have an administrator verify the websocket server URL in the General Settings."
                )
            );
            return;
        }
        this.registerer = new Registerer(this.voip, this.__sipJsUserAgent);
        this.registerer.register();
    }

    /**
     * Triggered when the transport transitions from connected state.
     *
     * @param {Error} error
     */
    _onDisconnect(error) {
        this.voip.triggerError(
            _t(
                "The websocket connection with the server has been lost. Please try to refresh the page."
            )
        );
        console.error(error);
    }
}

export const userAgentService = {
    dependencies: ["ringtone", "voip"],
    start(env, services) {
        return new UserAgent(env, services);
    },
};
