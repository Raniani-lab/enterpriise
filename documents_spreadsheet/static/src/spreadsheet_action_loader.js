/** @odoo-module **/

import { registry } from "@web/core/registry";
import { loadBundle } from "@web/core/assets";


const actionRegistry = registry.category("actions");


async function loadAndVerifyAction(env, actionName, actionLazyLoader) {
    await loadBundle("documents_spreadsheet.o_spreadsheet", { js: true, css: true });

    if (actionRegistry.get(actionName) === actionLazyLoader) {
        // At this point, the real spreadsheet client action should be loaded and have
        // replaced this function in the action registry. If it's not the case,
        // it probably means that there was a crash in the bundle (e.g. syntax
        // error). In this case, this action will remain in the registry, which
        // will lead to an infinite loop. To prevent that, we push another action
        // in the registry.
        actionRegistry.add(
            actionName,
            () => {
                const msg = _.str.sprintf(env._t("%s couldn't be loaded"), actionName);
                env.services.notification.add(msg, { type: "danger" });
            },
            { force: true }
        );
    }
}


const loadActionSpreadsheet = async (env, context) => {
    await loadAndVerifyAction(env, "action_open_spreadsheet", loadActionSpreadsheet);

    return {
        ...context,
        target: "current",
        tag: "action_open_spreadsheet",
        type: "ir.actions.client",
    };
};


const loadActionSpreadsheetTemplate = async (env, context) => {
    await loadAndVerifyAction(env, "action_open_template", loadActionSpreadsheetTemplate);

    return {
        ...context,
        target: "current",
        tag: "action_open_template",
        type: "ir.actions.client",
    };
};

actionRegistry.add("action_open_spreadsheet", loadActionSpreadsheet);
actionRegistry.add("action_open_template", loadActionSpreadsheetTemplate);
