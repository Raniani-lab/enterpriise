/** @odoo-module */

import { AbstractMacro } from "@knowledge/macros/abstract_macro";
import { dragAndDrop } from "@knowledge/macros/utils";

export class UseAsAttachmentMacro extends AbstractMacro {
    /**
     * @override
     * @returns {Array[Object]}
     */
    macroAction() {
        const action = super.macroAction();
        action.steps.push({
            trigger: function() {
                this.validatePage();
                const el = this.getFirstVisibleElement('.o-mail-Chatter-topbar button[aria-label="Attach files"]');
                if (el) {
                    const attachmentBoxEl = this.getFirstVisibleElement('.o-mail-AttachmentList');
                    if (attachmentBoxEl) {
                        return attachmentBoxEl;
                    } else {
                        el.click();
                    }
                } else {
                    this.searchInXmlDocNotebookTab('.oe_chatter');
                }
                return null;
            }.bind(this),
            action: (el) => el.scrollIntoView(),
        }, this.unblockUI);
        return action;
    }
}

export class AttachToMessageMacro extends AbstractMacro {
    /**
     * @override
     * @returns {Array[Object]}
     */
    macroAction() {
        const action = super.macroAction();
        action.steps.push({
            trigger: function() {
                this.validatePage();
                const el = this.getFirstVisibleElement('.o-mail-Chatter-sendMessage');
                if (el) {
                    if (el.classList.contains('active')) {
                        return el;
                    } else {
                        el.click();
                    }
                } else {
                    this.searchInXmlDocNotebookTab('.oe_chatter');
                }
                return null;
            }.bind(this),
            action: (el) => {
                el.scrollIntoView();
            },
        }, {
            trigger: function() {
                this.validatePage();
                return this.getFirstVisibleElement('.o-mail-Composer button[title="Attach files"]');
            }.bind(this),
            action: dragAndDrop.bind(this, 'dragenter', this.data.dataTransfer),
        }, {
            trigger: function () {
                this.validatePage();
                return this.getFirstVisibleElement('.o-mail-Composer-dropzone');
            }.bind(this),
            action: dragAndDrop.bind(this, 'drop', this.data.dataTransfer),
        }, this.unblockUI);
        return action;
    }
}
