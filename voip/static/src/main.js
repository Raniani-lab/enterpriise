/** @odoo-module **/

import { VoipService } from "@voip/voip_service";

import { serviceRegistry } from "web.core";

serviceRegistry.add("voip_service", VoipService);
