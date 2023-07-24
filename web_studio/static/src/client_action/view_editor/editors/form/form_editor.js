/** @odoo-module */

import { formView } from "@web/views/form/form_view";
import { FormEditorRenderer } from "./form_editor_renderer/form_editor_renderer";
import { FormEditorController } from "./form_editor_controller/form_editor_controller";
import { FormEditorCompiler } from "./form_editor_compiler";
import { registry } from "@web/core/registry";
import { omit } from "@web/core/utils/objects";
import { makeModelErrorResilient } from "@web_studio/client_action/view_editor/editors/utils";
import { getModifier } from "@web/views/view_compiler";
import { FormEditorSidebar } from "./form_editor_sidebar/form_editor_sidebar";
import { getStudioNoFetchFields } from "../utils";

class EditorArchParser extends formView.ArchParser {
    parse(arch, models, modelName) {
        const parsed = super.parse(...arguments);
        const noFetch = getStudioNoFetchFields(parsed.fieldNodes);
        parsed.fieldNodes = omit(parsed.fieldNodes, ...noFetch.fieldNodes);
        return parsed;
    }

    parseXML() {
        const result = super.parseXML(...arguments);
        const copy = result.cloneNode(true);

        Array.from(copy.querySelectorAll("field > tree, field > form, field > kanban")).forEach(
            (el) => {
                if (getModifier(el, "invisible")) {
                    el.remove();
                }
            }
        );

        return copy;
    }
}

class Model extends formView.Model {}
Model.Record = class RecordNoEdit extends formView.Model.Record {
    get isInEdition() {
        return false;
    }
};

const formEditor = {
    ...formView,
    ArchParser: EditorArchParser,
    Compiler: FormEditorCompiler,
    Renderer: FormEditorRenderer,
    Controller: FormEditorController,
    props(genericProps, editor, config) {
        const props = formView.props(genericProps, editor, config);
        props.Model = makeModelErrorResilient(Model);
        props.preventEdit = true;
        return props;
    },
    Sidebar: FormEditorSidebar,
};
registry.category("studio_editors").add("form", formEditor);

/**
 *  Drag/Drop Validation
 */
const HOOK_CLASS_WHITELIST = [
    "o_web_studio_field_signature",
    "o_web_studio_field_html",
    "o_web_studio_field_many2many",
    "o_web_studio_field_one2many",
    "o_web_studio_field_tabs",
    "o_web_studio_field_columns",
    "o_web_studio_field_lines",
];
const HOOK_TYPE_BLACKLIST = ["genericTag", "afterGroup", "afterNotebook", "insideSheet"];

const isBlackListedHook = (draggedEl, hookEl) =>
    !HOOK_CLASS_WHITELIST.some((cls) => draggedEl.classList.contains(cls)) &&
    HOOK_TYPE_BLACKLIST.some((t) => hookEl.dataset.type === t);

function canDropNotebook(hookEl) {
    if (hookEl.dataset.type === "page") {
        return false;
    }
    if (hookEl.closest(".o_group")) {
        return false;
    }
    return true;
}

function canDropGroup(hookEl) {
    if (hookEl.dataset.type === "insideGroup") {
        return false;
    }
    if (hookEl.closest(".o_group")) {
        return false;
    }
    return true;
}

function isValidFormHook({ hook, element }) {
    const draggingStructure = element.dataset.structure;
    switch (draggingStructure) {
        case "notebook": {
            if (!canDropNotebook(hook)) {
                return false;
            }
            break;
        }
        case "group": {
            if (!canDropGroup(hook)) {
                return false;
            }
            break;
        }
    }
    if (isBlackListedHook(element, hook)) {
        return false;
    }

    return true;
}
formEditor.isValidHook = isValidFormHook;
