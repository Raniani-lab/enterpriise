/** @odoo-module */

import { FormController } from '@web/views/form/form_controller';
import { KnowledgeSidebar } from '@knowledge/components/sidebar/sidebar';
import { useService } from "@web/core/utils/hooks";

const { useChildSubEnv, useRef } = owl;

export class KnowledgeArticleFormController extends FormController {
    setup() {
        super.setup();
        this.root = useRef('root');
        this.orm = useService('orm');

        useChildSubEnv({
            createArticle: this.createArticle.bind(this),
            ensureArticleName: this.ensureArticleName.bind(this),
            openArticle: this.openArticle.bind(this),
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

    get resId() {
        return this.model.root.resId;
    }

    /**
     * Create a new article and open it.
     * @param {String} category - Category of the new article
     * @param {integer} targetParentId - Id of the parent of the new article (optional)
     */
    async createArticle(category, targetParentId) {
        const articleId = await this.orm.call(
            "knowledge.article",
            "article_create",
            [],
            {
                is_private: category === 'private',
                parent_id: targetParentId ? targetParentId : false
            }
        );
        this.openArticle(articleId);
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
     * @param {integer} - resId: id of the article to open
     */
    async openArticle(resId) {

        if (!resId || resId === this.resId) {
            return;
        }

        // Usually in a form view, an input field is added to the list of dirty
        // fields of a record when the input loses the focus.
        // In this case, the focus could still be on the name input or in the
        // body when clicking on an article name. Since the blur event is not
        // asynchronous, the focused field is not yet added in the record's 
        // list of dirty fields when saving before opening another article.
        // askChanges() allows to make sure that these fields are added to the
        // record's list of dirty fields if they have been modified.
        await this.model.root.askChanges();
        // blur to remove focus on the active element
        document.activeElement.blur();
        
        await this.beforeLeave();

        const scrollView = document.querySelector('.o_scroll_view_lg');
        if (scrollView) {
            // hide the flicker
            scrollView.style.visibility = 'hidden';
            // Scroll up if we have a desktop screen
            scrollView.scrollTop = 0;
        }

        const mobileScrollView = document.querySelector('.o_knowledge_main_view');
        if (mobileScrollView) {
            // Scroll up if we have a mobile screen
            mobileScrollView.scrollTop = 0;
        }
        // load the new record
        try {
            await this.model.load({
                resId: resId,
            });
        } catch {
            this.actionService.doAction(
                await this.orm.call('knowledge.article', 'action_home_page', [false]),
                {stackPosition: 'replaceCurrentAction'}
            );
        }

        if (scrollView) {
            // Show loaded document
            scrollView.style.visibility = 'visible';
        }
    }

    /*
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

KnowledgeArticleFormController.template = "knowledge.ArticleFormView";
KnowledgeArticleFormController.components = {
    ...FormController.components,
    KnowledgeSidebar,
};
