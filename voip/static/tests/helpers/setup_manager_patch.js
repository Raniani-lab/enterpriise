/* @odoo-module */

import { setupManager } from "@mail/../tests/helpers/webclient_setup";

import { ringtoneService } from "@voip/ringtone_service";
import { userAgentService } from "@voip/user_agent_service";
import { voipService } from "@voip/voip_service";

import { patch } from "@web/core/utils/patch";

patch(setupManager, "voip", {
    setupServices(...args) {
        const services = { ...this._super(...args) };
        if (!services.voip) {
            // some tests pass a fake voip service
            services.voip = voipService;
        }
        return Object.assign(services, {
            ringtone: ringtoneService,
            "voip.user_agent": userAgentService,
        });
    },
});
