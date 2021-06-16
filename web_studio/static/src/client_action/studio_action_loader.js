/** @odoo-module **/

import { registry } from "@web/core/registry";
import { loadPublicAsset } from "@web/core/assets";

async function loadStudioAction(env) {
    // Some parts of the studio client action depend on the wysiwyg widgets, so load them first
    await loadPublicAsset("web_editor.compiled_assets_wysiwyg", env.services.orm);
    await loadPublicAsset("web_studio.compiled_assets_studio", env.services.orm);
    return {
        target: "current",
        tag: "studio",
        type: "ir.actions.client",
    };
}

registry.category("actions").add("studio", loadStudioAction);
