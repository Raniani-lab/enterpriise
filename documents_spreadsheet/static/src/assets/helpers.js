/** @odoo-module */

/**
 * Remove user specific info from the context
 * @param {Object} context
 * @returns {Object}
 */
 export function removeContextUserInfo(context) {
    context = { ...context };
    delete context.allowed_company_ids;
    delete context.tz;
    delete context.lang;
    delete context.uid;
    return context;
}
