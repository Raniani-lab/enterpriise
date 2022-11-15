/* @odoo-module */

import { voipService } from "@voip/voip_service";
import { userAgentService } from "@voip/user_agent_service";
import { registry } from "@web/core/registry";
import { ringtoneService } from "@voip/ringtone_service";

registry
    .category("services")
    .add("voip", voipService)
    .add("ringtone", ringtoneService)
    .add("voip.user_agent", userAgentService);
