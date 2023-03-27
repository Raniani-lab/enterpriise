/** @odoo-module **/

import { browser } from "@web/core/browser/browser";
import { useService } from "@web/core/utils/hooks";
import { patch } from "@web/core/utils/patch";
import { WebClientEnterprise } from "@web_enterprise/webclient/webclient";
import { onWillStart } from "@odoo/owl";

const USER_DEVICES_MODEL = "mail.partner.device";

patch(WebClientEnterprise.prototype, "mail_enterprise", {
    /**
     * @override
     */
    setup() {
        this._super();
        this.rpc = useService("rpc");
        this.orm = useService("orm");
        if (this._canSendNativeNotification) {
            this._subscribePush();
        }
        onWillStart(async () => {
            if (!browser.navigator.permissions) {
                // Avoid blank page due to error in OWL when some browser doesn't support permission
                return;
            }
            const notificationPerm = await browser.navigator.permissions.query({name: "notifications"});
            notificationPerm.onchange = () => {
                if (this._canSendNativeNotification) {
                    this._subscribePush();
                } else {
                    this._unsubscribePush();
                }
            }
        });

    },
    /**
     *
     * @returns {boolean}
     * @private
     */
    get _canSendNativeNotification() {
        return Boolean(browser.Notification && browser.Notification.permission === "granted");
    },

    /**
     * Subscribe device from push notification
     *
     * @private
     * @return {Promise<void>}
     */
    async _subscribePush() {
        const pushManager = await this.pushManager();
        if (!pushManager) {
            return;
        }
        let subscription = await pushManager.getSubscription();
        const previousEndpoint = browser.localStorage.getItem(`${USER_DEVICES_MODEL}_endpoint`);
        // This may occur if the subscription was refreshed by the browser,
        // but it may also happen if the subscription has been revoked or lost.
        if (!subscription) {
            subscription = await pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: await this._getApplicationServerKey(),
            });
            browser.localStorage.setItem(`${USER_DEVICES_MODEL}_endpoint`, subscription.endpoint);
        }
        const kwargs = subscription.toJSON();
        if (previousEndpoint && subscription.endpoint !== previousEndpoint) {
            kwargs.previous_endpoint = previousEndpoint;
        }
        await this.orm.call(USER_DEVICES_MODEL, "register_devices", [], kwargs);
    },

    /**
     * Unsubscribe device from push notification
     *
     * @private
     * @return {Promise<void>}
     */
    async _unsubscribePush() {
        const pushManager = await this.pushManager();
        if (!pushManager) {
            return;
        }
        const subscription = await pushManager.getSubscription();
        if (!subscription) {
            return;
        }
        await this.orm.call(USER_DEVICES_MODEL, "unregister_devices", [], {
            endpoint: subscription.endpoint,
        });
        await subscription.unsubscribe();
        browser.localStorage.removeItem(`${USER_DEVICES_MODEL}_endpoint`);
    },

    /**
     * Retrieve the PushManager interface of the Push API provides a way to receive notifications from third-party
     * servers as well as request URLs for push notifications.
     *
     * @return {Promise<PushManager>}
     */
    async pushManager() {
        const registration = await browser.navigator.serviceWorker.getRegistration();
        return registration.pushManager;
    },

    /**
     *
     * The Application Server Key is need to be an Uint8Array.
     * This format is used when the exchanging secret key between client and server.
     * This base64 to Uint8Array implementation is inspired by https://github.com/gbhasha/base64-to-uint8array
     *
     * @private
     * @return {Uint8Array}
     */
    async _getApplicationServerKey() {
        const vapid_public_key_base64 = await this.orm.call(USER_DEVICES_MODEL, "get_web_push_vapid_public_key");
        const padding = '='.repeat((4 - vapid_public_key_base64.length % 4) % 4);
        const base64 = (vapid_public_key_base64 + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');
        const rawData = atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }
});
