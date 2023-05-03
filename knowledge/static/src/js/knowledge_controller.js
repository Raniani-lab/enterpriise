/** @odoo-module */

import { FormController } from '@web/views/form/form_controller';
const { useChildSubEnv, useRef } = owl;

export class KnowledgeArticleFormController extends FormController {
    setup() {
        super.setup();
        this.root = useRef('root');
        useChildSubEnv({
            ensureArticleName: this.ensureArticleName.bind(this),
            renameArticle: this.renameArticle.bind(this),
            toggleAside: this.toggleAside.bind(this),
        });
    }

    /**
     * Check that the title is set or not before closing the tab and
     * save the whole article.
     * @override 
     */
    async beforeUnload(ev) {
        this.ensureArticleName();
        await super.beforeUnload(ev); 
    }

    /**
     * If the article has no name set, tries to rename it.
     */
    ensureArticleName() {
        if (!this.model.root.data.name) {
            this.renameArticle();
        }
    }
    
    /**
     * Callback executed before the record save (if the record is valid).
     * When an article has no name set, use the title (first h1 in the
     * body) to try to save the artice with a name.
     * @overwrite
     */
    onWillSaveRecord(record) {
        this.ensureArticleName();
    }

    /**
     * Rename the article using the given name, or using the article title if
     * no name is given (first h1 in the body). If no title is found, the
     * article is kept untitled.
     * @param {string} name - new name of the article
     */
    renameArticle(name) {
        if (!name) {
            const title = this.root.el.querySelector('#body_0 h1');
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

    /**
     * @param {boolean} force
     */
    toggleAside(force) {
        const container = this.root.el.querySelector('.o_knowledge_form_view');
        container.classList.toggle('o_toggle_aside', force);
    }
}

// Open articles in edit mode by default
KnowledgeArticleFormController.defaultProps = {
    ...FormController.defaultProps,
    mode: 'edit',
};
