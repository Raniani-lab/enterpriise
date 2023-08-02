/* @odoo-module */

import { browser } from "@web/core/browser/browser";
import { patch } from "@web/core/utils/patch";
import { OutOfFocusService } from "@mail/core/common/out_of_focus_service";

patch(OutOfFocusService.prototype, {
    async notify(message) {
        const modelsHandleByPush = ["mail.thread", "discuss.channel"];
        if (
            modelsHandleByPush.includes(message.resModel) &&
            (await this.hasServiceWorkInstalledAndPushSubscriptionActive())
        ) {
            return;
        }
        super.notify(...arguments);
    },
    async hasServiceWorkInstalledAndPushSubscriptionActive() {
        const registration = await browser.navigator.serviceWorker?.getRegistration();
        if (registration) {
            const pushManager = await registration.pushManager;
            if (pushManager) {
                const subscription = await pushManager.getSubscription();
                return !!subscription;
            }
        }
        return false;
    },
});
