/** @odoo-module */

import { ThreadService } from "@mail/core/common/thread_service";
import { patch } from "@web/core/utils/patch";
import { removeFromArray } from "@mail/utils/common/arrays";
import { assignDefined } from "@mail/utils/common/misc";

patch(ThreadService.prototype, {
    canLeave(thread) {
        return thread.type !== "whatsapp" && super.canLeave(thread);
    },

    canUnpin(thread) {
        if (thread.type === "whatsapp") {
            return this.getCounter(thread) === 0;
        }
        return super.canUnpin(thread);
    },

    getCounter(thread) {
        if (thread.type === "whatsapp") {
            return thread.message_unread_counter || thread.message_needaction_counter;
        }
        return super.getCounter(thread);
    },

    async getMessagePostParams({thread}) {
        const params = await super.getMessagePostParams(...arguments);

        if (thread.type === "whatsapp") {
            params.post_data.message_type = "whatsapp_message";
        }
        return params;
    },

    update(thread, data) {
        if (thread.type === "whatsapp") {
            assignDefined(thread, data, ["whatsapp_channel_valid_until"]);
            if (!this.store.discuss.whatsapp.threads.includes(thread.localId)) {
                this.store.discuss.whatsapp.threads.push(thread.localId);
            }
        }
        super.update(thread, data);
    },

    async openWhatsAppChannel(id, name) {
        const thread = this.store.Thread.insert({
            id,
            model: "discuss.channel",
            name,
            type: "whatsapp",
            channel: { avatarCacheKey: "hello" },
        });
        if (!thread.hasSelfAsMember) {
            const data = await this.orm.call("discuss.channel", "whatsapp_channel_join_and_pin", [[id]]);
            this.update(thread, data);
        } else if (!thread.is_pinned) {
            this.pin(thread);
        }
        this.sortChannels();
        this.open(thread);
    },

    remove(thread) {
        removeFromArray(this.store.discuss.whatsapp.threads, thread.localId);
        super.remove(thread);
    },

    sortChannels() {
        super.sortChannels();
        // WhatsApp Channels are sorted by most recent interest date time in the sidebar.
        this.store.discuss.whatsapp.threads.sort((localId_1, localId_2) => {
            const thread1 = this.store.Thread.records[localId_1];
            const thread2 = this.store.Thread.records[localId_2];
            return thread2.lastInterestDateTime.ts - thread1.lastInterestDateTime.ts;
        });
    },
});
