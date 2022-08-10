/** @odoo-module */

import { qweb } from 'web.core';

export const ArticlesStructureBehaviorMixin = {
    /**
     * Re-apply contenteditable="false" that is turned on automatically by the base editor code.
     * This avoids having our custom links opening the editor toolbar on click.
     * 
     * Also re-apply the bootstrap 'collapse' that is removed during sanitizing.
     *
     * @override
     */
    applyAttributes: function () {
        this._super.apply(this, arguments);
        if (this.mode === 'edit') {
            this.anchor.querySelectorAll('a').forEach(element => {
                element.setAttribute('contenteditable', 'false');
            });
        }
    },

    //--------------------------------------------------------------------------
    // Articles Structure - BUSINESS LOGIC
    //--------------------------------------------------------------------------

    /**
     * Transforms the flat search_read result into a parent/children articles hierarchy.
     *
     * @param {Integer} parent
     * @param {Array} allArticles
     * @returns {Array} articles structure
     */
    _buildArticlesStructure: function (parent, allArticles) {
        return allArticles
            .filter((article) => article.parent_id && article.parent_id[0] === parent)
            .map((article) => {
                return {
                    id: article.id,
                    name: article.display_name,
                    child_ids: this._buildArticlesStructure(article.id, allArticles),
                };
            });
    },

    /**
     * Updates the article structure.
     * This block displays article's children.
     * We only take the direct children (and not sub-sequent descendants)
     * if 'this.childrenOnly' is True.
     *
     * This block is used by the /articles_structure and /articles_index commands and their
     * respective toolbars through a system of Mixin to avoid code duplication.
     *
     * This mixin only needs those properties set to be able to function:
     * - this.articleId - the id of the concerned article
     * - this.childrenOnly - controls if we only display one level of depth or ALL children
     * - this.articlesStructureAnchor - the 'o_knowledge_articles_structure_wrapper' linked to the
     *   behavior or toolbar
     * - (direct access to the '_rpc' and 'do_action' methods).
     *
     * Small design effect note:
     * To avoid creating a flickering effect when search_read is done very fast, we use a fake promise
     * that is resolved after 500ms when updating the Articles Structure.
     */
    _updateArticlesStructure: async function () {
        this.minimumWait = this.minimumWait !== undefined ? this.minimumWait : 500;

        const refreshButton = this.articlesStructureAnchor.getElementsByClassName('btn-link')[0];
        if (refreshButton) {
            refreshButton.classList.add('disabled');
        }
        const articlesStructureElement = this.articlesStructureAnchor.getElementsByClassName('o_knowledge_articles_structure_content')[0];

        // force temporary height to avoid a size flicker
        articlesStructureElement.style.height = `${articlesStructureElement.clientHeight}px`;
        articlesStructureElement.classList.add('text-center');
        articlesStructureElement.innerHTML = '<i class="fa fa-refresh fa-spin ms-3 mb-3 position-relative"/>';

        const domain = [[
            'parent_id',
            this.childrenOnly ? '=' : 'child_of',
            this.articleId
        ], [
            'is_article_item',
            '=',
            false
        ]];

        const minimumWaitPromise = new Promise(resolve => setTimeout(resolve, this.minimumWait));
        const articlesChildrenPromise = this._rpc({
            model: 'knowledge.article',
            method: 'search_read',
            fields: ['id', 'display_name', 'parent_id'],
            orderBy: [{name: 'sequence', asc: true}],
            domain: domain,
        });

        const promiseResults = await Promise.all([
            minimumWaitPromise,
            articlesChildrenPromise]
        );

        const articlesStructure = this._buildArticlesStructure(
            this.articleId, promiseResults[1]);

        const updatedStructure = qweb.render('knowledge.articles_structure', {
            'articles': articlesStructure
        });

        articlesStructureElement.innerHTML = updatedStructure;
        articlesStructureElement.style.height = null;
        if (refreshButton) {
            refreshButton.classList.remove('disabled');
        }
        articlesStructureElement.classList.remove('text-center');

        $(this.articlesStructureAnchor).on(
            'click',
            '.o_knowledge_article_structure_link',
            this._onArticleLinkClick.bind(this)
        );
    },

    //--------------------------------------------------------------------------
    // Articles Structure - HANDLERS
    //--------------------------------------------------------------------------

    /**
     * Opens the article in the side tree menu.
     *
     * @param {Event} event
     */
     _onArticleLinkClick: async function (event) {
        event.preventDefault();

        this.do_action('knowledge.ir_actions_server_knowledge_home_page', {
            additional_context: {
                res_id: parseInt(event.target.getAttribute('data-oe-nodeid'))
            }
        });
    },
};
