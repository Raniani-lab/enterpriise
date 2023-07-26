/* @odoo-module */

import { EventBus, reactive } from "@odoo/owl";

import { VoipSystrayItem } from "@voip/components/voip_systray_item/voip_systray_item";
import { DialingPanelContainer } from "@voip/legacy/dialing_panel_container";

import { browser } from "@web/core/browser/browser";
import { _t } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";
import { sprintf } from "@web/core/utils/strings";

const systrayRegistry = registry.category("systray");
const mainComponentsRegistry = registry.category("main_components");

export class Voip {
    /**
     * Legacy widget that was used as the core of the VoIP application. It is
     * provided as a field to ease its retrieval but newer code should not rely
     * on it as the goal is to get rid of it at some point.
     *
     * @type {import("@voip/legacy/dialing_panel").DialingPanel}
     */
    legacyDialingPanelWidget;
    /**
     * Either 'demo' or 'prod'. In demo mode, phone calls are simulated in the
     * interface but no RTC sessions are actually established.
     *
     * @type {string}
     */
    mode;
    /**
     * The address of the PBX server. Used as the hostname in SIP URIs.
     *
     * @type {string}
     */
    pbxAddress;
    /**
     * The WebSocket URL of the signaling server that will be used to
     * communicate SIP messages between Odoo and the PBX server.
     *
     * @type {string}
     */
    webSocketUrl;

    constructor(env, services) {
        this.env = env;
        this.bus = new EventBus();
        this.notificationService = services["notification"];
        this.settings = services["mail.user_settings"];
        this.store = services["mail.store"];
        // VoIP config is retrieved by init_messaging RPC to minimize the number
        // of requests at start-up. This is why we need to wait until
        // mail.messaging is ready to update the VoIP config.
        services["mail.messaging"].isReady.then(() => Object.assign(this, this.store.voipConfig));
        return reactive(this);
    }

    /**
     * Determines if `voip_secret` and `voip_username` settings are defined for
     * the current user.
     *
     * @returns {boolean}
     */
    get areCredentialsSet() {
        return Boolean(this.settings.voip_username && this.settings.voip_secret);
    }

    /**
     * With some providers, the authorization username (the one used to register
     * with the PBX server) differs from the username. This getter is intended
     * to provide a way to override the authorization username.
     *
     * @returns {string}
     */
    get authorizationUsername() {
        return this.settings.voip_username || "";
    }

    /**
     * @returns {boolean}
     */
    get canCall() {
        return (
            this.mode === "demo" ||
            (this.hasRtcSupport && this.isServerConfigured && this.areCredentialsSet)
        );
    }

    /**
     * @returns {string}
     */
    get cleanedExternalDeviceNumber() {
        return this.settings.external_device_number
            ? this.cleanPhoneNumber(this.settings.external_device_number)
            : "";
    }

    /**
     * @returns {boolean}
     */
    get hasRtcSupport() {
        return Boolean(
            window.RTCPeerConnection && window.MediaStream && browser.navigator.mediaDevices
        );
    }

    /**
     * Determines if `pbxAddress` and `webSocketUrl` have been provided.
     *
     * @returns {boolean}
     */
    get isServerConfigured() {
        return Boolean(this.pbxAddress && this.webSocketUrl);
    }

    /**
     * Determines if the `should_call_from_another_device` setting is set and if
     * an `external_device_number` has been provided.
     *
     * @returns {boolean}
     */
    get willCallFromAnotherDevice() {
        return (
            this.settings.should_call_from_another_device && this.cleanedExternalDeviceNumber !== ""
        );
    }

    call(params = {}) {
        if (!this.canCall || !params.number) {
            return;
        }
        this.notificationService.add(
            sprintf(_t("Calling %(phone number)s"), { "phone number": params.number })
        );
        if (params.fromActivity) {
            this.legacyDialingPanelWidget.callFromActivityWidget(params);
        } else {
            this.legacyDialingPanelWidget.callFromPhoneWidget(params);
        }
    }

    /**
     * Removes whitespaces, dashes, slashes and periods from a phone number.
     *
     * @param {string} phoneNumber
     * @returns {string}
     */
    cleanPhoneNumber(phoneNumber) {
        // U+00AD is the "soft hyphen" character
        return phoneNumber.replace(/[\s-/.\u00AD]/g, "");
    }

    /**
     * Triggers an error that will be displayed in the softphone, and blocks the
     * UI by default.
     *
     * @param {string} message The error message to be displayed.
     * @param {Object} [options={}]
     * @param {boolean} [options.isNonBlocking=false] If true, the error will
     * not block the UI.
     */
    triggerError(message, { isNonBlocking = false } = {}) {
        this.bus.trigger("sip_error", { isNonBlocking, message });
    }
}

export const voipService = {
    dependencies: ["mail.messaging", "user", "notification", "mail.user_settings", "mail.store"],
    async start(env, { user }) {
        const isEmployee = await user.hasGroup("base.group_user");
        if (!isEmployee) {
            return {
                bus: new EventBus(),
                get canCall() {
                    return false;
                },
            };
        }
        systrayRegistry.add("voip", { Component: VoipSystrayItem });
        mainComponentsRegistry.add("voip.DialingPanelContainer", {
            Component: DialingPanelContainer,
        });
        return new Voip(...arguments);
    },
};
