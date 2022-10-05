/** @odoo-module */

import { FormController } from '@web/views/form/form_controller';

export class KnowledgeArticleFormController extends FormController {
    get className() {
        const result = super.className;
        result["o_form_with_borderless_input"] = false;
        return result;
    }
}

// Open articles in edit mode by default
KnowledgeArticleFormController.defaultProps = {
    ...FormController.defaultProps,
    mode: 'edit',
};
