/** @odoo-module **/

import { voipService } from "@voip/voip_service";

import { registry } from "@web/core/registry";

registry.category('services').add("voip", voipService);
