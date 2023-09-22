/** @odoo-module */

import { decodeDataBehaviorProps, getVideoUrl } from "@knowledge/js/knowledge_utils";
import { fetchValidHeadings } from '@knowledge/js/tools/knowledge_tools';
import publicWidget from '@web/legacy/js/public/public_widget';
import { renderToElement } from "@web/core/utils/render";
import { debounce, throttleForAnimation } from "@web/core/utils/timing";

publicWidget.registry.KnowledgeWidget = publicWidget.Widget.extend({
    selector: '.o_knowledge_public_view',
    events: {
        'keyup .knowledge_search_bar': '_searchArticles',
        'click .o_article_caret': '_onFold',
        'click .o_knowledge_toc_link': '_onTocLinkClick',
        'click .o_knowledge_article_load_more': '_loadMoreArticles',
    },

    init() {
        this._super(...arguments);
        this.rpc = this.bindService("rpc");
    },

    /**
     * @override
     * @returns {Promise}
     */
    start: function () {
        return this._super.apply(this, arguments).then(() => {
            this.$id = this.$el.data('article-id');
            this.storageKey = "knowledge.unfolded.ids";
            this.unfoldedArticlesIds = localStorage.getItem(this.storageKey)?.split(";").map(Number) || [];
            this._renderTree();
            this._setResizeListener();
            // Debounce the search articles method to reduce the number of rpcs
            this._searchArticles = debounce(this._searchArticles, 500);
            /**
             * The embedded views are currently not supported in the frontend due
             * to some technical limitations. Instead of showing an empty div, we
             * will render a placeholder inviting the user to log in. Once logged
             * in, the user will be redirected to the backend and should be able
             * to load the embedded view.
             */
            const placeholder = renderToElement('website_knowledge.embedded_view_placeholder', {
                url: `/knowledge/article/${this.$id}`,
            });
            const $container = $('.o_knowledge_behavior_type_embedded_view');
            $container.empty();
            $container.append(placeholder);

            // Load the video iframes:
            for (const anchor of this.el.querySelectorAll(".o_knowledge_behavior_type_video")) {
                const props = decodeDataBehaviorProps(anchor.dataset.behaviorProps);
                const url = getVideoUrl(props.platform, props.videoId, props.params);
                const iframe = document.createElement("iframe");
                iframe.src = url.toString();
                iframe.frameborder = "0";
                iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
                anchor.replaceChildren();
                anchor.append(iframe);
            }
        });
    },

    _loadMoreArticles: async function (ev) {
        ev.preventDefault();

        let addedArticles;
        const rpcParams = {
            active_article_id: this.$id || false,
            parent_id: ev.target.dataset['parentId'] || false,
            limit: ev.target.dataset['limit'],
            offset: ev.target.dataset['offset'] || 0,
        };

        addedArticles = await this.rpc('/knowledge/public_sidebar/load_more', rpcParams);

        const listRoot = ev.target.closest('ul');
        // remove existing "Load more" link
        ev.target.remove();
        // remove the 'forced' displayed active article
        const forcedDisplayedActiveArticle = listRoot.querySelector(
            '.o_knowledge_article_force_show_active_article');
        if (forcedDisplayedActiveArticle) {
            forcedDisplayedActiveArticle.remove();
        }
        // insert the returned template
        listRoot.insertAdjacentHTML('beforeend', addedArticles);
    },

    /**
     * @param {Event} event
     */
    _searchArticles: async function (ev) {
        ev.preventDefault();
        const searchTerm = this.$('.knowledge_search_bar').val();
        if (!searchTerm) {
            // Renders the basic user article tree (with only its cached articles unfolded)
            await this._renderTree();
            return;
        }
        // Renders articles based on search term in a flatenned tree (no sections nor child articles)
        const container = this.el.querySelector('.o_knowledge_tree');
        try {
            const htmlTree = await this.rpc('/knowledge/public_sidebar/', {
                search_term: searchTerm,
                active_article_id: this.$id,
            });
            container.innerHTML = htmlTree;
        } catch {
            container.innerHTML = "";
        }
    },

    /**
     * Enables the user to resize the aside block.
     * Note: When the user grabs the resizer, a new listener will be attached
     * to the document. The listener will be removed as soon as the user releases
     * the resizer to free some resources.
     */
    _setResizeListener: function () {
        const onPointerMove = throttleForAnimation(event => {
            event.preventDefault();
            this.el.style.setProperty('--knowledge-article-sidebar-size', `${event.pageX}px`);
        }, 100);
        const onPointerUp = () => {
            this.el.removeEventListener('pointermove', onPointerMove);
            document.body.style.cursor = "auto";
            document.body.style.userSelect = "auto";
        };
        const resizeSidebar = () => {
            // Add style to root element because resizing has a transition delay,
            // meaning that the cursor is not always on top of the resizer.
            document.body.style.cursor = "col-resize";
            document.body.style.userSelect = "none";
            this.el.addEventListener('pointermove', onPointerMove);
            this.el.addEventListener('pointerup', onPointerUp, {once: true});
        };
        this.el.querySelector('.o_knowledge_article_form_resizer span').addEventListener(
            'pointerdown', resizeSidebar
        );
    },

    /**
     * Renders the tree listing all articles.
     * To minimize loading time, the function will initially load the root articles.
     * The other articles will be loaded lazily: The user will have to click on
     * the carret next to an article to load and see their children.
     * The id of the unfolded articles will be cached so that they will
     * automatically be displayed on page load.
     */
    _renderTree: async function () {
        const container = this.el.querySelector('.o_knowledge_tree');
        const params = new URLSearchParams(document.location.search);
        if (Boolean(params.get('auto_unfold'))) {
            this.unfoldedArticlesIds.push(this.$id);
        }
        try {
            const htmlTree = await this.rpc('/knowledge/public_sidebar', {
                active_article_id: this.$id,
                unfolded_articles_ids: this.unfoldedArticlesIds,
            });
            container.innerHTML = htmlTree;
        } catch {
            container.innerHTML = "";
        }
    },

    _fetchChildrenArticles: function (parentId) {
        return this.rpc('/knowledge/public_sidebar/children', { parent_id: parentId });
    },

    /**
     * Callback function called when the user clicks on the carret of an article
     * The function will load the children of the article and append them to the
     * dom. Then, the id of the unfolded article will be added to the cache.
     * (see: `_renderTree`).
     * @param {Event} event
     */
     _onFold: async function (event) {
        event.stopPropagation();
        const $button = $(event.currentTarget);
        this._fold($button);
     },
    _fold: async function ($button) {
        const $icon = $button.find('i');
        const $li = $button.closest('li');
        const articleId = $li.data('articleId');
        const $ul = $li.find('> ul');

        if ($icon.hasClass('fa-caret-down')) {
            $ul.hide();
            if (this.unfoldedArticlesIds.indexOf(articleId) !== -1) {
                this.unfoldedArticlesIds.splice(this.unfoldedArticlesIds.indexOf(articleId), 1);
            }
            $icon.removeClass('fa-caret-down');
            $icon.addClass('fa-caret-right');
        } else {
            if ($ul.length) {
                // Show hidden children
                $ul.show();
            } else {
                let children;
                try {
                    children = await this._fetchChildrenArticles($li.data('articleId'));
                } catch (error) {
                    // Article is not accessible anymore, remove it from the sidebar
                    $li.remove();
                    throw error;
                }
                const $newUl = $('<ul/>').append(children);
                $li.append($newUl);
            }
            if (this.unfoldedArticlesIds.indexOf(articleId) === -1) {
                this.unfoldedArticlesIds.push(articleId);
            }
            $icon.removeClass('fa-caret-right');
            $icon.addClass('fa-caret-down');
        }
        localStorage.setItem(this.storageKey, this.unfoldedArticlesIds.join(";"),
        );
    },

    /**
     * Scroll through the view to display the matching heading.
     * Adds a small highlight in/out animation using a class.
     *
     * @param {Event} event
     */
    _onTocLinkClick: function (event) {
        event.preventDefault();
        const headingIndex = parseInt(event.target.getAttribute('data-oe-nodeid'));
        const targetHeading = fetchValidHeadings(this.$el[0])[headingIndex];
        if (targetHeading) {
            targetHeading.scrollIntoView({
                behavior: 'smooth',
            });
            targetHeading.classList.add('o_knowledge_header_highlight');
            setTimeout(() => {
                targetHeading.classList.remove('o_knowledge_header_highlight');
            }, 2000);
        }
    },
});
