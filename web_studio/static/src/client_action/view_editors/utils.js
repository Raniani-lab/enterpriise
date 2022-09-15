/** @odoo-module */

export function cleanHooks(el) {
    for (const hookEl of el.querySelectorAll(".o_web_studio_nearest_hook")) {
        hookEl.classList.remove("o_web_studio_nearest_hook");
    }
}

export function getActiveHook(el) {
    return el.querySelector(".o_web_studio_nearest_hook");
}

export function getDroppedValues({ droppedData, xpath, fieldName, position }) {
    const isNew = droppedData.isNew;
    let values;
    if (isNew) {
        values = {
            type: "add",
            structure: droppedData.structure,
            field_description: droppedData.field_description,
            xpath,
            new_attrs: droppedData.new_attrs,
            position: position,
        };
    } else {
        if (xpath === droppedData.xpath) {
            // the field is dropped on itself
            return;
        }
        values = {
            type: "move",
            xpath,
            position: position,
            structure: "field",
            new_attrs: {
                name: droppedData.fieldName,
            },
        };
    }
    return values;
}

export function getHooks(el) {
    return [...el.querySelectorAll(".o_web_studio_hook")];
}

export function extendEnv(env, extension) {
    const nextEnv = Object.create(env);
    const descrs = Object.getOwnPropertyDescriptors(extension);
    Object.defineProperties(nextEnv, descrs);
    return Object.freeze(nextEnv);
}

// A standardized method to determine if a component is visible
export function studioIsVisible(props) {
    return props.studioIsVisible !== undefined ? props.studioIsVisible : true;
}
