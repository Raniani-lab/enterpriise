/* @odoo-module */

import { Thread } from "@mail/core/common/thread_model";
import { assignDefined } from "@mail/utils/common/misc";
import { patch } from "@web/core/utils/patch";
import { deserializeDateTime } from "@web/core/l10n/dates";

import { toRaw } from "@odoo/owl";

patch(Thread.prototype, {
    update(data) {
        if (this.type === "whatsapp") {
            assignDefined(this, data, ["whatsapp_channel_valid_until"]);
            if (!this._store.discuss.whatsapp.threads.includes(this)) {
                this._store.discuss.whatsapp.threads.push(this);
            }
        }
        super.update(data);
    },

    get allowReactions() {
        return this.type === "whatsapp" ? false : super.allowReactions;
    },

    get allowSetLastSeenMessage() {
        return this.type === "whatsapp" || super.allowSetLastSeenMessage;
    },

    get imgUrl() {
        if (this.type !== "whatsapp") {
            return super.imgUrl;
        }
        return "/mail/static/src/img/smiley/avatar.jpg";
    },

    get isChatChannel() {
        return this.type === "whatsapp" || super.isChatChannel;
    },

    get isChannel() {
        return this.type === "whatsapp" || super.isChannel;
    },

    get whatsappChannelValidUntilDatetime() {
        if (!this.whatsapp_channel_valid_until) {
            return undefined;
        }
        return toRaw(deserializeDateTime(this.whatsapp_channel_valid_until));
    },

    insert(data) {
        const thread = super.insert(data);
        if (thread.type === "whatsapp") {
            if (data?.channel) {
                assignDefined(thread, data.channel, ["anonymous_name"]);
            }
        }
        return thread;
    },
});
