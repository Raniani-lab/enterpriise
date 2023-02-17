/** @odoo-module */

import { FormController } from '@web/views/form/form_controller';
const { useChildSubEnv, useRef } = owl;

export class KnowledgeArticleFormController extends FormController {
    setup() {
        super.setup();
        this.root = useRef('root');
        useChildSubEnv({
            renameArticle: this.renameArticle.bind(this),
        });
    }
    
    /**
     * Callback executed before the record save (if the record is valid).
     * When an article has no name set, use the title (first h1 in the
     * body) to try to save the artice with a name.
     * @overwrite
     */
    onWillSaveRecord(record) {
        if (!record.data.name) {
            this.renameArticle();
        }
    }

    renameArticle(name) {
        if (!name) {
            const title = this.root.el.querySelector('#body h1');
            if (title) {
                name = title.textContent.trim();
                if (!name) {
                    return;
                }
            }
        }
        this.model.root.update({name});
        // Update name in the sidebar (TODO: remove when sidebar component)
        const selector = `.o_article[data-article-id="${this.model.root.resId}"] > .o_article_handle > div > .o_article_name`;
        this.root.el.querySelectorAll(selector).forEach(articleName => {
            articleName.textContent = name || this.env._t("Untitled");
        });
    }
}

// Open articles in edit mode by default
KnowledgeArticleFormController.defaultProps = {
    ...FormController.defaultProps,
    mode: 'edit',
};
