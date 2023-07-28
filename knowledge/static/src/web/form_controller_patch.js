/** @odoo-module */

import { FormController } from "@web/views/form/form_controller";
import { patch } from "@web/core/utils/patch";
import { useService } from "@web/core/utils/hooks";
import { evaluateBooleanExpr } from "@web/core/py_js/py";
import { onWillUnmount, useSubEnv } from "@odoo/owl";
import { CallbackRecorder } from "@web/webclient/actions/action_hook";


/**
 * Knowledge articles can interact with some records with the help of the
 * @see KnowledgeCommandsService .
 * Those records need to have specific html field which name is in the following
 * list. This list is ordered and the first match found in a record will take
 * precedence. Once a match is found, it is stored in the
 * KnowledgeCommandsService to be accessed later by an article.
 * If the field is inside a Form notebook page, the page must have a name
 * attribute, or else it won't be considered as Knowledge macros won't be able
 * to access it through a selector.
 */
const KNOWLEDGE_RECORDED_FIELD_NAMES = [
    'note',
    'memo',
    'description',
    'comment',
    'narration',
    'additional_note',
    'internal_notes',
    'notes',
];

const FormControllerPatch = {
    setup() {
        super.setup(...arguments);
        this.command = useService("command");
        if (!this.env.inDialog) {
            this.knowledgeCommandsService = useService('knowledgeCommandsService');
            useSubEnv({
                __knowledgeUpdateCommandsRecordInfo__: new CallbackRecorder(),
            });
            // Register the last viewed record only once when leaving the Form view.
            onWillUnmount(() => {
                if (
                    this.props.resModel !== 'knowledge.article' &&
                    this.env.config.breadcrumbs &&
                    this.env.config.breadcrumbs.length
                ) {
                    const commandsRecordInfo = this._evaluateRecordCandidate();
                    if (this.knowledgeCommandsService.isRecordCompatibleWithMacro(commandsRecordInfo)) {
                        this.knowledgeCommandsService.setCommandsRecordInfo(commandsRecordInfo);
                    }
                }
            });
        }
    },
    /**
     * Evaluate the current record and register its relevant information in
     * @see KnowledgeCommandsService if it can be used in a Knowledge article
     * through a macro.
     *
     * @returns {Object} recordInfo refer to @see knowledgeCommandsService
     *          method @see setCommandsRecordInfo for the specification.
     */
    _evaluateRecordCandidate() {
        const record = this.model.root;
        const fields = this.props.fields;
        const xmlDoc = this.props.archInfo.xmlDoc;
        const breadcrumbs = this.knowledgeCommandsService.getBreadcrumbsIdentifier(this.env.config.breadcrumbs);
        // format stored by the knowledgeCommandsService
        const commandsRecordInfo = {
            resId: this.model.root.resId,
            resModel: this.props.resModel,
            breadcrumbs: breadcrumbs,
            canPostMessages: false,
            canAttachFiles: false,
            withHtmlField: false,
            fieldInfo: {},
            xmlDoc: this.props.archInfo.xmlDoc,
        };

        // check whether the form view has a chatter
        if (this.props.archInfo.xmlDoc.querySelector('.oe_chatter')) {
            for (const callback of this.env.__knowledgeUpdateCommandsRecordInfo__.callbacks) {
                callback(commandsRecordInfo);
            }
        }

        if (this.props.mode === "readonly" || !this.canEdit) {
            return commandsRecordInfo;
        }

        // check if there is any html field usable with knowledge
        loopFieldNames: for (const fieldName of KNOWLEDGE_RECORDED_FIELD_NAMES) {
            if (fieldName in record.activeFields &&
                fields[fieldName].type === 'html' &&
                !fields[fieldName].readonly
            ) {

                const readonlyModifier = record.activeFields[fieldName].readonly;
                const invisibleModifier = record.activeFields[fieldName].invisible;
                if (evaluateBooleanExpr(readonlyModifier, record.evalContext) || evaluateBooleanExpr(invisibleModifier, record.evalContext)) {
                    continue loopFieldNames;
                }
                // Parse the xmlDoc to find all instances of the field that are
                // not descendants of another field and whose parents are
                // visible (relative to the current record's context)
                const xmlFields = Array.from(xmlDoc.querySelectorAll(`field[name="${fieldName}"]`));
                const directXmlFields = xmlFields.filter((field) => {
                    return !(field.parentElement.closest('field'));
                });
                loopDirectXmlFields: for (const xmlField of directXmlFields) {
                    const xmlFieldParent = xmlField.parentElement;
                    let xmlInvisibleParent = xmlFieldParent.closest('[invisible]');
                    while (xmlInvisibleParent) {
                        const invisibleParentModifier = xmlInvisibleParent.getAttribute('invisible');
                        if (evaluateBooleanExpr(invisibleParentModifier, record.evalContext)) {
                            continue loopDirectXmlFields;
                        }
                        xmlInvisibleParent = xmlInvisibleParent.parentElement &&
                            xmlInvisibleParent.parentElement.closest('[invisible]');
                    }
                    const page = xmlField.closest('page');
                    const pageName = page ? page.getAttribute('name') : undefined;
                    // If the field is inside an unnamed notebook page, ignore
                    // it as if it was unavailable, since the macro will not be
                    // able to open it to access the field (the name is used as
                    // a selector).
                    if (!page || pageName) {
                        commandsRecordInfo.fieldInfo = {
                            name: fieldName,
                            string: fields[fieldName].string,
                            pageName: pageName,
                        };
                        break loopFieldNames;
                    }
                }
            }
        }
        if (commandsRecordInfo.fieldInfo.name) {
            commandsRecordInfo.withHtmlField = true;
        }
        return commandsRecordInfo;
    },
    async onClickSearchKnowledgeArticle() {
        if (this.model.root.isDirty || this.model.root.isNew) {
            const saved = await this.model.root.save();
            if (!saved) {
                return;
            }
        }
        this.command.openMainPalette({ searchValue: "?" });
    },
};

patch(FormController.prototype, FormControllerPatch);
