/** @odoo-module */

/**
 * Plugin for OdooEditor. Allow to remove temporary toolbars content which are
 * not destined to be stored in the field_html
 */
export class KnowledgePlugin {
    constructor ({ editor }) {
        this.editor = editor;
    }
    /**
     * @param {Element} editable
     */
    cleanForSave(editable) {
        for (const node of editable.querySelectorAll('.o_knowledge_behavior_anchor')) {
            if (node.oKnowledgeBehavior) {
                node.oKnowledgeBehavior.destroy();
                delete node.oKnowledgeBehavior;
            }

            const nodesToRemove = node.querySelectorAll('.o_knowledge_clean_for_save');
            for (const node of nodesToRemove) {
                node.remove();
            }
        }
    }

    /**
     * @param {Selection} selection
     */
    onSelectionChange(selection) {
        if (selection.anchorNode) {
            let anchor = selection.anchorNode;
            if (anchor.nodeType === Node.TEXT_NODE) {
                anchor = anchor.parentNode;
            }
            if (anchor.closest('.o_knowledge_behavior_type_embedded_view')) {
                throw 'STOP_HANDLING_SELECTION';
            }
        }
    }
}
