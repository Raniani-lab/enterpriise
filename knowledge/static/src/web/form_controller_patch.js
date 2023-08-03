/** @odoo-module */

import { FormController } from "@web/views/form/form_controller";
import { patch } from "@web/core/utils/patch";
import { useService } from "@web/core/utils/hooks";
import { evaluateBooleanExpr } from "@web/core/py_js/py";
import { useEffect } from "@odoo/owl";


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
        this.knowledgeCommandsService = useService('knowledgeCommandsService');
        // useEffect based on the id of the current record, in order to
        // properly register a newly created record, or the switch to another
        // record without leaving the current form view.
        if (!this.env.inDialog) {
            useEffect(
                () => this._commandsRecordInfoRegistration(),
                () => [this.model.root.resId],
            );
        }
    },
    /**
     * Copy of the breadcrumbs array used as an identifier for a
     * commandsRecordInfo object.
     *
     * @returns {Array[Object]}
     */
    _getBreadcrumbsIdentifier() {
        return this.env.config.breadcrumbs.map(breadcrumb => {
            return {
                jsId: breadcrumb.jsId,
                name: breadcrumb.name,
            };
        });
    },
    /**
     * Update the @see KnowledgeCommandsService to clean obsolete
     * commandsRecordInfo and to register a new one if the current record
     * can be used by certain Knowledge commands.
     */
    _commandsRecordInfoRegistration() {
        if (this.env.config.breadcrumbs && this.env.config.breadcrumbs.length) {
            if (this.props.resModel === 'knowledge.article') {
                this._unregisterCommandsRecordInfo(this._getBreadcrumbsIdentifier());
            } else if (this.model.root.resId) {
                this._searchCommandsRecordInfo();
            }
        }
    },
    /**
     * Evaluate the current record and notify @see KnowledgeCommandsService if
     * it can be used in a Knowledge article.
     */
    _searchCommandsRecordInfo() {
        /**
         * this.model.__bm__.get([...] {raw: true}) is used to get the raw data
         * of the record (and not the post-processed this.model.root.data).
         * This is because invisible and readonly modifiers from the raw code of
         * the view have to be evaluated to check whether the current user has
         * access to a specific element in the view (i.e.: chatter or
         * html_field), and @see Domain is currently only able to evaluate such
         * a domain with the raw data.
         */
        const record = this.model.root;
        const fields = this.props.fields;
        const xmlDoc = this.props.archInfo.xmlDoc;
        const breadcrumbs = this._getBreadcrumbsIdentifier();
        // format stored by the knowledgeCommandsService
        const commandsRecordInfo = {
            resId: this.model.root.resId,
            resModel: this.props.resModel,
            breadcrumbs: breadcrumbs,
            withChatter: false,
            withHtmlField: false,
            fieldInfo: {},
            xmlDoc: this.props.archInfo.xmlDoc,
        };

        // check whether the form view has a chatter with messages
        const chatterNode = this.props.archInfo.xmlDoc.querySelector('.oe_chatter');
        if (chatterNode && chatterNode.querySelector('field[name="message_ids"]')) {
            commandsRecordInfo.withChatter = true;
            this.knowledgeCommandsService.setCommandsRecordInfo(commandsRecordInfo);
        }

        if (this.props.mode === "readonly" || !this.canEdit) {
            return;
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
            this.knowledgeCommandsService.setCommandsRecordInfo(commandsRecordInfo);
        }
    },
    /**
     * Compare the current breadcrumbs identifier with a previously registered
     * commandsRecordInfo and unregister it if they don't match.
     *
     * @param {Array[Object]} breadcrumbs
     * @param {boolean} revoke whether to unregister the commandsRecordInfo when
     *                  breadcrumbs match (revoke = true) or when they don't
     *                  match (revoke = false)
     */
    _unregisterCommandsRecordInfo(breadcrumbs, revoke = false) {
        function areBreadcrumbsArraysEqual(firstBreadcrumbsArray, secondBreadcrumbsArray) {
            for (let i = 0; i < firstBreadcrumbsArray.length; i++) {
                if (firstBreadcrumbsArray[i].jsId !== secondBreadcrumbsArray[i].jsId ||
                    firstBreadcrumbsArray[i].name !== secondBreadcrumbsArray[i].name) {
                    return false;
                }
            }
            return true;
        }
        const commandsRecordInfo = this.knowledgeCommandsService.getCommandsRecordInfo();
        if (!commandsRecordInfo) {
            return;
        }
        let shouldUnregister = revoke;
        if (commandsRecordInfo.breadcrumbs.length > breadcrumbs.length) {
            shouldUnregister = !revoke;
        } else {
            const slicedBreadcrumbs = breadcrumbs.slice(0, commandsRecordInfo.breadcrumbs.length);
            if (areBreadcrumbsArraysEqual(commandsRecordInfo.breadcrumbs, slicedBreadcrumbs)) {
                shouldUnregister = revoke;
            } else {
                shouldUnregister = !revoke;
            }
        }
        if (shouldUnregister) {
            this.knowledgeCommandsService.setCommandsRecordInfo(null);
        }
    },
    async onClickSearchKnowledgeArticle() {
        if (this.model.root.isDirty || this.model.root.isNew) {
            const saved = await this.model.root.save({ stayInEdition: true, useSaveErrorDialog: true });
            if (!saved) {
                return;
            }
        }
        this.command.openMainPalette({ searchValue: "?" });
    },
};

patch(FormController.prototype, FormControllerPatch);
