/** @odoo-module */

/**
 * Plugin for OdooEditor. Allow to remove temporary highlights which are
 * not destined to be stored in the html_field.
 */
export class KnowledgePlugin {
    constructor ({ editor }) {
        this.editor = editor;
    }
    /**
     * In this function we are also removing all unnecessary highlights from the body, this way we do not
     * save any of them and we clean the body. This can happen, e.g., if you open a new article right after
     * clicking on a header inside a Table of Content, which highlights its corresponding header.
     * @param {Element} editable
     */
    cleanForSave(editable) {
        for (const header of editable.querySelectorAll('.o_knowledge_header_highlight')) {
            header.classList.remove('o_knowledge_header_highlight');
        }
    }
}
