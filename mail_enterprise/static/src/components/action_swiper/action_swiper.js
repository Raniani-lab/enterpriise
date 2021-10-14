/** @odoo-module **/

import { getMessagingComponent, registerMessagingComponent } from "@mail/utils/messaging_component";

import { ActionSwiper } from "@web_enterprise/core/action_swiper/action_swiper";

registerMessagingComponent(ActionSwiper);
const swiper = getMessagingComponent("ActionSwiper");
// Messaging components only update based on props, but in this case we also
// want to update when our slot needs to be re-rendered, and there is no way to
// know whether the slot has changed, so we always update.
const originalSetup = swiper.prototype.setup;
swiper.prototype.setup = function () {
    originalSetup.call(this);
    this.shouldUpdate = function () {
        return true;
    };
};
