/** @odoo-module **/

import AbstractService from "web.AbstractService";
import { registry } from "@web/core/registry";

import { VoipSystrayItem } from "@voip/js/voip_systray_item";
import { DialingPanelContainer } from "@voip/js/dialing_panel_container";

const { EventBus } = owl;

const serviceRegistry = registry.category("services");
const systrayRegistry = registry.category("systray");
const mainComponentRegistry = registry.category("main_components");

export const VoipService = AbstractService.extend({
    dependencies: ["messaging"],
    /**
     * @override {web.AbstractService}
     */
    async start() {
        const voipService = {
            dependencies: ["user"],
            async start(env, { user }) {
                const isEmployee = await user.hasGroup('base.group_user');
                if (isEmployee) {
                    const bus = new EventBus();
                    systrayRegistry.add('voip', { Component: VoipSystrayItem, props: { bus } });
                    mainComponentRegistry.add('voip.DialingPanelContainer', {
                        Component: DialingPanelContainer,
                        props: { bus },
                    });
                }
            },
        };
        
        serviceRegistry.add("voip", voipService);
    },
});
