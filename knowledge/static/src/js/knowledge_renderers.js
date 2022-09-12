/** @odoo-module */

import { ConfirmationDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import emojis from '@mail/js/emojis';
import { FormRenderer } from '@web/views/form/form_renderer';
import KnowledgeTreePanelMixin from '@knowledge/js/tools/tree_panel_mixin';
import { patch } from "@web/core/utils/patch";
import MoveArticleDialog from "@knowledge/components/move_article_dialog/move_article_dialog";
import PermissionPanel from '@knowledge/components/permission_panel/permission_panel';
import { qweb as QWeb } from 'web.core';
import { sprintf } from '@web/core/utils/strings';
import { useService } from "@web/core/utils/hooks";

const disallowedEmojis = ['💩', '👎', '💔', '😭', '😢', '😐', '😕', '😞', '😢', '💀'];
const emojisRandomPickerSource = emojis.filter(emoji => !disallowedEmojis.includes(emoji.unicode));
const { onMounted, onWillUnmount, useRef } = owl;

export class KnowledgeArticleFormRenderer extends FormRenderer {

    //--------------------------------------------------------------------------
    // Component
    //--------------------------------------------------------------------------
    setup() {
        super.setup();

        this.actionService = useService("action");
        this.dialog = useService("dialog");
        this.messagingService = useService("messaging");
        this.orm = useService("orm");
        this.rpc = useService("rpc");
        
        this.root = useRef('root');
        this.tree = useRef('tree');
        
        this.messagingService.get().then(messaging => this.messaging = messaging);
        this._onAddEmoji = this._onAddEmoji.bind(this);
        this._onRemoveEmoji = this._onRemoveEmoji.bind(this);
        // ADSC: Remove when tree component
        onMounted(() => {
            this.messaging.messagingBus.addEventListener('knowledge_add_emoji', this._onAddEmoji);
            this.messaging.messagingBus.addEventListener('knowledge_remove_emoji', this._onRemoveEmoji);
            this._renderTree(this.resId, '/knowledge/tree_panel');
            this._setEmojiPickerListener();

            // Focus inside the body (default_focus does not work yet, to check
            // when field_html will be converted)
            const body = this.root.el.querySelector('.o_knowledge_editor .note-editable');
            if (body) {
                body.focus();
            }
        });
        onWillUnmount(() => {
            this.messaging.messagingBus.removeEventListener('knowledge_add_emoji', this._onAddEmoji);
            this.messaging.messagingBus.removeEventListener('knowledge_remove_emoji', this._onRemoveEmoji);
        });
    }


    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Open the browser file uploader allowing to add a cover to the article
     */
    addCover() {
        this.root.el.querySelector('.o_knowledge_cover_image .o_select_file_button').click();
    }

    /**
     * Add a random icon to the article.
     */
    addIcon() {
        const icon = emojisRandomPickerSource[Math.floor(Math.random() * emojisRandomPickerSource.length)].unicode;
        this._renderEmoji(icon, this.resId);
    }

    /**
     * Copy the current article in private section and open it.
     */
    async copyArticleAsPrivate() {
        const articleId = await this.orm.call(
            "knowledge.article",
            "action_make_private_copy",
            [this.resId]
        );
        this.openArticle(articleId);
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
     * @param {integer} - resId: id of the article to open
     */
    async openArticle(resId) {
        // Focus out of name input to prevent showing an error when opening an
        // article while the name input is focused and empty
        if (document.activeElement.id === "name" && document.activeElement.value === "") {
            document.activeElement.blur();
        } else if (this.resId) {  // Don't save when NoRecord helper is shown
            await this.props.record.save();
        }
        this.actionService.doAction('knowledge.ir_actions_server_knowledge_home_page', {
            stackPosition: 'replaceCurrentAction',
            additionalContext: {
                res_id: resId ? resId : false
            }
        });
    }

    get resId() {
        return this.props.record.resId;
    }

    /**
     * Resize the sidebar when the resizer is grabbed.
     */
    resizeSidebar() {
        const onPointerMove = _.throttle(event => {
            event.preventDefault();
            document.querySelector('.o_knowledge_form_view').style.setProperty('--default-sidebar-size', `${event.pageX}px`);
        }, 100);

        this.root.el.addEventListener('pointermove', onPointerMove);
        this.root.el.addEventListener('pointerup', () => this.root.el.removeEventListener('pointermove', onPointerMove), {once: true});
    }

    /**
     * Show/hide the chatter. Before showing it, it is reloaded so that new messages,
     * activities,... will be shown.
     */
    toggleChatter() {
        if (this.resId) {
            const chatter = this.root.el.querySelector('.o_knowledge_chatter');
            if (chatter.classList.contains('d-none')) {
                // Reload chatter
                this.env.model.notify();
            }
            chatter.classList.toggle('d-none');
            this.root.el.querySelector('.btn-chatter').classList.toggle('active');
        }
    }

    /**
     * Add/Remove article from favorites and reload the favorite tree.
     * @param {event} Event
     */
    async toggleFavorite(event) {
        await this.props.record.update({is_user_favorite: !this.props.record.data.is_user_favorite});
        // ADSC: move when tree component
        await this.props.record.save({stayInEdition: true});
        const template = await this.rpc(
            '/knowledge/tree_panel/favorites',
            {
                active_article_id: this.resId,
            }
        );
        this.tree.el.querySelector('.o_favorite_container').innerHTML = template;
        this._setTreeFavoriteListener();
    }


    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * Show the Dialog allowing to move the current article.
     */
    onMoveArticleClick() {
        this.dialog.add(
            MoveArticleDialog,
            {
                articleName: this.props.record.data.name,
                articleId: this.resId,
                category: this.props.record.data.category,
                moveArticle: this._moveArticle.bind(this),
                reloadTree: this._renderTree.bind(this),
            }
        );
    }

    /**
     * When the user clicks on the name of the article, checks if the article
     * name hasn't been set yet. If it hasn't, it will look for a title in the
     * body of the article and set it as the name of the article.
     * @param {Event} event
     */
    async _onNameClick(event) {
        const name = event.target.value;
        if (name === this.env._t('Untitled')) {
            this._rename(this.resId, '');
        }
    }


    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------    

    /**
     * Try to move the given article to the new given position.
     * @param {integer} articleId
     * @param {Object} position
     * @param {Function} onSuccess
     * @param {Function} onReject
     */
    async _confirmMoveArticle(articleId, position, onSuccess, onReject) {
        try {
            const result = await this.orm.call(
                'knowledge.article',
                'move_to',
                [articleId],
                position
            );
            if (result) {
                onSuccess();
            } else {
                onReject();
            }
        } catch {
            onReject();
        }
    }
    
    /**
     * Fetch the template of the children of the given article to add in the
     * article tree.
     * @param {integer} parentId
     * 
     * @returns {Promise}
     */
    _fetchChildrenArticles(parentId) {
        return this.rpc(
            '/knowledge/tree_panel/children',
            {
                parent_id: parentId
            }
        );
    }

    /**
     * @param {Object} data
     * @param {integer} data.article_id
     * @param {String} data.oldCategory
     * @param {String} data.newCategory
     * @param {integer} [data.target_parent_id]
     * @param {integer} [data.before_article_id]
     * @param {Function} data.onSuccess
     * @param {Function} data.onReject
     */
    async _moveArticle(data) {
        var newPosition = {
            category: data.newCategory,
        };
        if (typeof data.target_parent_id !== 'undefined') {
            newPosition.parent_id = data.target_parent_id;
        }
        if (typeof data.before_article_id !== 'undefined') {
            newPosition.before_article_id = data.before_article_id;
        }
        if (data.newCategory === data.oldCategory) {
            await this._confirmMoveArticle(data.article_id, newPosition, data.onSuccess, data.onReject);
        } else {
            let message;
            if (data.newCategory === 'workspace') {
                message = this.env._t("Are you sure you want to move this article to the Workspace? It will be shared with all internal users.");
            } else if (data.newCategory === 'private') {
                message = this.env._t("Are you sure you want to move this to private? Only you will be able to access it.");
            } else if (data.newCategory === 'shared' && data.target_parent_id) {
                const article = document.querySelector(`[data-article-id='${data.target_parent_id}']`);
                const emoji = article.querySelector('.o_article_emoji').textContent || '';
                const name = article.querySelector('.o_article_name').textContent || '';
                message = sprintf(this.env._t('Are you sure you want to move this article under "%s%s"? It will be shared with the same persons.'), emoji, name);
            }
            this.dialog.add(ConfirmationDialog, {
                body: message,
                confirm: async () => await this._confirmMoveArticle(data.article_id, newPosition, data.onSuccess, data.onReject),
                cancel: data.onReject
            });
        }
    }

    /**
     * @private
     * @param {CustomEvent} ev
     * @param {Object} ev.detail
     * @param {KnowledgeArticle} param0.detail.article
     * @param {Emoji} param0.detail.emoji
     */
    _onAddEmoji(ev) {
        this._renderEmoji(ev.detail.emoji.codepoints, ev.detail.article.id);
    }

    /**
     * @private
     * @param {CustomEvent} ev
     * @param {Object} ev.detail
     * @param {KnowledgeArticle} param0.detail.article
     */
    _onRemoveEmoji(ev) {
        this._renderEmoji(false, ev.detail.article.id);
    }

    /**
     * Rename the article. To prevent empty names, checks for a valid title in
     * the article, or renames the article to the default article name.
     * @param {integer} id - Target id
     * @param {string} name - Target Name
     */
    _rename(id, name) {
        if (name === '') {
            const articleTitle = this.root.el.querySelector('.o_knowledge_editor h1');
            if (articleTitle) {
                name = articleTitle.textContent.trim();
            }
            name = name || this.env._t('Untitled');
            this.props.record.update({'name': name});
        }
        // ADSC: Remove when tree component
        // Updates the name in the sidebar
        this.tree.el.querySelector(`.o_article[data-article-id="${id}"] > .o_article_handle > .o_article_name`).textContent = name;
    }

    /**
     * Render the updated emoji of the given article (if the article is the
     * current article, update the record first).
     * @param {String} unicode
     * @param {integer} articleId
     */
    _renderEmoji(unicode, articleId) {
        if (articleId === this.resId) {
            this.props.record.update({'icon': unicode});
        }
        // ADSC: remove when tree component
        // Updates the emojis in the sidebar
        const emojis = this.tree.el.querySelectorAll(`.o_article_emoji_dropdown[data-article-id="${articleId}"] > .o_article_emoji`);
        for (let idx = 0; idx < emojis.length; idx++) {
            emojis[idx].textContent = unicode || '📄';
        }
    }

    /**
     * Render the tree listing all articles.
     * To minimize loading time, the function will initially load the root articles.
     * The other articles will be loaded lazily: The user will have to click on
     * the carret next to an article to load and see their children.
     * The id of the unfolded articles will be cached so that they will
     * automatically be displayed on page load.
     * @param {integer} activeArticleId
     * @param {String} route
     */
    async _renderTree(activeArticleId, route) {
        let unfoldedArticles = localStorage.getItem('unfoldedArticles');
        unfoldedArticles = unfoldedArticles ? unfoldedArticles.split(";").map(Number) : false;
        try {
            const htmlTree = await this.rpc(route,
                {
                    active_article_id: activeArticleId,
                    unfolded_articles: unfoldedArticles,
                }
            );
            this.tree.el.innerHTML = htmlTree;
            this._setTreeListener();
            this._setTreeFavoriteListener();

            // ADSC: Make tree component with "t-on-"" instead of adding these eventListeners
            this.tree.el.addEventListener('click', (ev) => {
                const target = ev.target;
                if (target.classList.contains('o_article_name')) {
                    this.openArticle(parseInt(target.closest('.o_article').dataset.articleId));
                } else {
                    const button = target.closest('button');
                    if (!button) {
                        return;
                    }
                    if (button.classList.contains('o_section_create')) {
                        this.createArticle(button.closest('.o_section').dataset.section);
                    } else if (button.classList.contains('o_article_create')) {
                        const parentId = parseInt(button.closest('.o_article').dataset.articleId);
                        this.createArticle(undefined, parentId);
                        this._addUnfolded(parentId.toString());
                    } else if (button.classList.contains('o_article_caret')) {
                        this._fold($(button));
                    }
                }
            });
        } catch {
            this.tree.el.innerHTML = "";
        }
    }

    /**
     * Update the sequence of favortie articles for the curent user.
     * @param {Array} favoriteIds - Updated sequence
     */
    _resequenceFavorites(favoriteIds) {
        this.rpc(
            '/web/dataset/resequence',
            {
                model: "knowledge.article.favorite",
                ids: favoriteIds,
                offset: 1,
            }
        );
    }

    /**
     * Setup the emoji picker listener(s) to open it when clicking on an emoji
     */
    _setEmojiPickerListener() {
        this.root.el.addEventListener('click', (ev) => {
            if (ev.target.closest('.o_article_emoji')) {
                this._showEmojiPicker(ev);
            }
        });
    }

    /**
     * Initializes the drag-and-drop behavior of the tree listing all articles.
     * Once this function is called, the user will be able to move an article
     * in the tree hierarchy by dragging an article around.
     * When an article is moved, the script will send an rpc call to the server
     * and the drag-and-drop behavior will be deactivated while the request is pending.
     * - If the rpc call succeeds, the drag-and-drop behavior will be reactivated.
     * - If the rpc call fails, the change will be undo and the drag-and-drop
     *   behavior will be reactivated.
     * Unfortunately, `nestedSortable` can only restore one transformation. Disabling
     * the drag-and-drop behavior will ensure that the tree structure can be restored
     * if something went wrong.
     * 
     * ADSC TODO: Move to tree component
     */
    _setTreeListener() {
        const $sortable = $('.o_tree');
        $sortable.nestedSortable({
            axis: 'y',
            handle: '.o_article_handle',
            items: 'li',
            listType: 'ul',
            toleranceElement: '> div',
            opacity: 0.6,
            placeholder: 'ui-sortable-placeholder',
            tolerance: 'intersect',
            helper: 'clone',
            cursor: 'grabbing',
            cancel: '.readonly',
            scrollSpeed: 6,
            delay: 150,
            distance: 10,
            /**
             * Prevent a non-root shared article from becoming one, because the
             * access rights cannot be inferred in that case.
             *
             * @param {jQuery} placeholder jQuery element which represents the
             *                 destination position (may be the placeholder or
             *                 the nestedSortableItem if it already moved)
             * @param {jQuery} placeholderParent undefined, required by the
             *                 library (mjs.nestedSortable) function signature
             * @param {jQuery} currentItem jQuery nestedSortableItem element
             * @returns {boolean}
             */
            isAllowed: (placeholder, placeholderParent, currentItem) => {
                const section = currentItem.data('nestedSortableItem').offsetParent[0].parentElement;
                return (
                    // destination is under another article
                    placeholder[0].parentElement.closest('.o_article') ||
                    // destination is not within the shared section
                    !placeholder[0].closest('section[data-section="shared"]') ||
                    // starting position was a root of the shared section
                    section.getAttribute('data-section') === "shared"
                );
            },
            /**
             * Prevent the display of a placeholder in the root shared section
             * if the current item cannot be dragged there.
             *
             * @param {Event} event
             * @param {Object} ui
             */
            start: (event, ui) => {
                const section = ui.item.data('nestedSortableItem').offsetParent[0].parentElement;
                if (section.getAttribute('data-section') !== 'shared') {
                    $('section[data-section="shared"]').addClass('o_no_root_placeholder');
                }
            },
            /**
             * @param {Event} event
             * @param {Object} ui
             */
            stop: (event, ui) => {
                $sortable.sortable('disable');

                const $li = $(ui.item);
                const $section = $li.closest('section');
                const $parent = $li.parentsUntil('.o_tree', 'li');

                const data = {
                    article_id: $li.data('article-id'),
                    oldCategory: $li.data('category'),
                    newCategory: $section.data('section')
                };

                if ($parent.length > 0) {
                    data.target_parent_id = $parent.data('article-id');
                }
                const $next = $li.next();
                if ($next.length > 0) {
                    data.before_article_id = $next.data('article-id');
                }
                $li.siblings('.o_knowledge_empty_info').addClass('d-none');
                $('.o_knowledge_empty_info:only-child').removeClass('d-none');
                const confirmMove = async () => {
                    const id = $li.data('parent-id');
                    if (typeof id !== 'undefined') {
                        const $parent = $(`.o_article[data-article-id="${id}"]`);
                        if (!$parent.children('ul').is(':parent')) {
                            const $caret = $parent.find('> .o_article_handle > .o_article_caret');
                            $caret.remove();
                            this._removeUnfolded(id.toString());
                        }
                    }
                    if ($parent.length > 0) {
                        const $firstParent = $parent.first();
                        const $caret = $firstParent.find('> .o_article_handle > .o_article_caret');
                        // Show other children if parent already had any
                        if ($caret.length > 0) {
                            const $icon = $caret.find("> i");
                            if ($icon.hasClass("fa-caret-right")) {
                                const $ul = $firstParent.find('> div > ul');
                                if ($ul.length) {
                                    // Show children content stored in sibling
                                    $firstParent.find('> ul').prepend($ul.find('> li'));
                                    $ul.remove();
                                    this._addUnfolded($firstParent.data('article-id').toString());
                                    $icon.removeClass('fa-caret-right');
                                    $icon.addClass('fa-caret-down');
                                } else {
                                    // Fetch children (which includes li, so remove it)
                                    $li.detach();
                                    await this._fold($firstParent);
                                    if ($li.find('.o_article_handle').hasClass('o_article_active')) {
                                        const $newLi = $(`#article_${$li.data('article-id')}`);
                                        $newLi.find('.o_article_handle').addClass('o_article_active');
                                    }
                                    
                                }
                            }
                        } else {
                            const $handle = $parent.children('.o_article_handle:first');
                            const $caret = $(QWeb.render('knowledge.knowledge_article_caret', {}));
                            $handle.prepend($caret);
                            this._addUnfolded($firstParent.data('article-id').toString());
                        }
                    }
                    $li.data('parent-id', $parent.data('article-id'));
                    $li.attr('data-parent-id', $parent.data('article-id'));
                    $li.data('category', data.newCategory);
                    $li.attr('data-category', data.newCategory);
                    let $children = $li.find('.o_article');
                    $children.each((_, child) => {
                        $(child).data('category', data.newCategory);
                        $(child).attr('data-category', data.newCategory);
                    });
                    const $sharedSection = $('section[data-section="shared"]');
                    if ($sharedSection.length) {
                        $sharedSection.removeClass('o_no_root_placeholder');
                        if (!$sharedSection.find('.o_article').length) {
                            $sharedSection.addClass('d-none');
                        }
                    }
                    $sortable.sortable('enable');
                };
                const rejectMove = () => {
                    /**
                     * When a move between two connected nestedSortable
                     * trees is canceled, more than one operation may be
                     * undone (library bug). To bypass sortable('cancel'),
                     * the last moved $item is returned at its original
                     * location (which may have to be restored too if it was
                     * cleaned), and a 'change' event is triggered from that
                     * rectified position for consistency (see the
                     * nestedSortable library).
                     */
                    const $item = ui.item.data('nestedSortableItem');
                    if ($item.domPosition.prev) {
                        // Restore $item position after its previous sibling
                        $item.domPosition.prev.after($item.currentItem[0]);
                    } else {
                        // Restore $item as the first child of the parent ul
                        $item.domPosition.parent.prepend($item.currentItem[0]);
                        if (!$item.domPosition.parent.parentElement) {
                            // The ul was cleaned from the document since it
                            // was empty, so it has to be restored too
                            const offsetParent = $item.offsetParent[0];
                            offsetParent.append($item.domPosition.parent);
                        }
                    }
                    // For consistency with the nestedSortable library,
                    // trigger the 'change' event from the moved $item
                    $item._trigger('change', null, $item._uiHash());
                    $('section[data-section="shared"]').removeClass('o_no_root_placeholder');
                    $sortable.sortable('enable');
                    $('.o_knowledge_empty_info').addClass('d-none');
                    $('.o_knowledge_empty_info:only-child').removeClass('d-none');
                };
                // The stop method may be called before the library calls
                // isAllowed (bug), so it has to be called again as a failsafe.
                if ($sortable.data('mjsNestedSortable').options.isAllowed(ui.item, undefined, ui.item)) {
                    this._moveArticle({...data,
                        onSuccess: confirmMove,
                        onReject: rejectMove,
                    });
                } else {
                    rejectMove();
                }
            },
        });
        // Allow drag and drop between sections:
        $('section[data-section="workspace"] .o_tree').nestedSortable(
            'option',
            'connectWith',
            'section[data-section="private"] .o_tree, section[data-section="shared"] .o_tree'
        );
        $('section[data-section="private"] .o_tree').nestedSortable(
            'option',
            'connectWith',
            'section[data-section="workspace"] .o_tree, section[data-section="shared"] .o_tree'
        );
        // connectWith both workspace and private sections:
        $('section[data-section="shared"] .o_tree').nestedSortable(
            'option',
            'connectWith',
            'section[data-section="workspace"] .o_tree, section[data-section="private"] .o_tree'
        );
    }

    /**
     * Unlike Bootstrap 4, Bootstrap 5 requires that the dropdown-menu be inside
     * a direct sibling of the dropdown toggle even though the real condition
     * technically is that the dropdown-menu and the dropdown toggle must have a
     * common ancestor with position: relative.
     *
     * In our case, we want to display a page blocker which will prevent the
     * user to drag an article while the emoji picker is open, along with the
     * emoji picker itself.
     *
     * To circumvent the harsher Bootstrap 5 limitation, the dropdown-menu
     * element is set manually if the default selector did not find it.
     *
     * @see bootstrap.dropdown._getMenuElement
     * @see bootstrap.selector-engine.next
     *
     * @private
     */
    _showEmojiPicker(ev) {
        this.root.el.querySelector('.o_knowledge_emoji_picker_container').classList.add('show');
        const articleId = Number(ev.target.closest('.o_article_emoji_dropdown').dataset.articleId) || this.resId;
        this.messaging.knowledge.update({
            currentArticle: { id: articleId },
            emojiPickerPopoverAnchorRef: { el: ev.target.closest('.o_article_emoji_dropdown .o_article_emoji') },
            emojiPickerPopoverView: {},
        });
    }
}

patch(KnowledgeArticleFormRenderer.prototype, "knowledge_article_form_renderer", KnowledgeTreePanelMixin);
KnowledgeArticleFormRenderer.components = {
    ...FormRenderer.components,
    PermissionPanel,
};
KnowledgeArticleFormRenderer.defaultProps = {
};
