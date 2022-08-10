/** @odoo-module */

import { ArticlesStructureBehaviorMixin } from './knowledge_article_structure_mixin.js';
import { ContentsContainerBehavior } from './knowledge_behaviors.js';
import { KnowledgeToolbar } from './knowledge_toolbars.js';

/**
 * A behavior for the structure commands @see Wysiwyg.
 * It creates a listing of children of this article.
 *
 * It is used by 2 different commands:
 * - /index that only list direct children
 * - /outline that lists all children
 *
 * It is an extension of @see ContentsContainerBehavior
 */
const ArticlesStructureBehavior = ContentsContainerBehavior.extend(ArticlesStructureBehaviorMixin, {
    //--------------------------------------------------------------------------
    // 'ContentsContainerBehavior' overrides
    //--------------------------------------------------------------------------

    /**
     * Adds the Article Click listener to open the associated article.
     *
     * @override
     */
     applyListeners: async function () {
        this._super.apply(this, arguments);

        if (this.mode === 'edit') {
            $(this.anchor).data('articleId', this.articleId);
        }

        if (this.mode === 'edit' && !$(this.anchor).hasClass('o_knowledge_articles_structure_loaded')) {
            // initial loading of article structure
            this.articlesStructureAnchor = this.anchor;
            this.childrenOnly = $(this.anchor).hasClass('o_knowledge_articles_structure_children_only');
            await this._updateArticlesStructure();
            $(this.anchor).addClass('o_knowledge_articles_structure_loaded');
        } else {
            $(this.anchor).on(
                'click',
                '.o_knowledge_article_structure_link',
                this._onArticleLinkClick.bind(this)
            );
        }
    },

    /**
     * @override
     */
    disableListeners: function () {
        this._super.apply(this, arguments);
        $(this.anchor).off('click', '.o_knowledge_article_structure_link');
    },
});

/**
 * Toolbar for the /articles_structure command
 */
 const ArticlesStructureToolbar = KnowledgeToolbar.extend(ArticlesStructureBehaviorMixin, {
    /**
     * Recover the eventual related record from @see KnowledgeService
     *
     * @override
     */
    init: function () {
        this._super.apply(this, arguments);
        this.articlesStructureAnchor = this.container;
    },

    /**
     * @override
     */
    _setupButton: function (button) {
        this._super.apply(this, arguments);

        if (button.dataset.call === 'update_articles_structure') {
            button.addEventListener("click", this._onUpdateArticlesStructureClick.bind(this));
        }
    },

    _onUpdateArticlesStructureClick: function (ev) {
        ev.stopPropagation();
        ev.preventDefault();

        this.articleId = parseInt($(this.container).data('articleId'));
        this.childrenOnly = $(this.container).hasClass(
            'o_knowledge_articles_structure_children_only');

        this._updateArticlesStructure();
    }
});

export { ArticlesStructureBehavior, ArticlesStructureToolbar };
