/** @odoo-module **/

import { registry } from "@web/core/registry";

import { VoipSystrayItem } from "@voip/js/voip_systray_item";
import { DialingPanelContainer } from "@voip/js/dialing_panel_container";
import { browser } from "@web/core/browser/browser";
import { sprintf } from "@web/core/utils/strings";

const { EventBus } = owl;

const systrayRegistry = registry.category("systray");
const mainComponentRegistry = registry.category("main_components");

export const voipService = {
    dependencies: ["messaging", "user", "notification"],
    async start(env, { user, messaging, notification }) {
        const isEmployee = await user.hasGroup('base.group_user');
        let bus;

        if (isEmployee) {
            bus = new EventBus();
            systrayRegistry.add('voip', { Component: VoipSystrayItem, props: { bus } });
            mainComponentRegistry.add('voip.DialingPanelContainer', {
                Component: DialingPanelContainer,
                props: { bus },
            });
        }

        const _messaging = await messaging.get();

        const hasMediaDevices = !!browser.navigator.mediaDevices
        const hasRtcSupport = _messaging.device.hasRtcSupport;

        function canCall() {
            if (!isEmployee || !hasRtcSupport || !hasMediaDevices) {
                return false;
            }
            const { voip } = _messaging;
            return (
                voip.mode !== "prod" ||
                voip.isServerConfigured &&
                voip.areCredentialsSet
            );
        }

       function call(params = {}) {
            if (!canCall() || !params.number) {
                return;
            }
            notification.add(sprintf(env._t("Calling %s"), params.number));
            bus.trigger('VOIP-CALL', params);
        }

        return {
            get canCall() {
                return canCall();
            },
            call,
        }
    },
};
