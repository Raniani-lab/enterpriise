/** @odoo-module */

/** converts and orderBy Object to a string equivalent that can be processed by orm.call */
export function orderByToString(orderBy) {
    return orderBy.map((o) => `${o.name} ${o.asc ? "ASC" : "DESC"}`).join(", ");
}
