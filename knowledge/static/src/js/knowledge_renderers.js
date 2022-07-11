/** @odoo-module */

import PermissionPanelWidget from './widgets/knowledge_permission_panel.js';
import EmojiPickerWidget from './widgets/knowledge_emoji_picker.js';
import FormRenderer from 'web.FormRenderer';
import KnowledgeTreePanelMixin from '@knowledge/js/tools/tree_panel_mixin';
import { qweb as QWeb } from 'web.core';


const KnowledgeArticleFormRenderer = FormRenderer.extend(KnowledgeTreePanelMixin, {
    className: 'o_knowledge_form_view',
    events: _.extend({}, FormRenderer.prototype.events, {
        'click .btn-chatter.active': '_onCloseChatter',
        'click .btn-chatter:not(.active)': '_onOpenChatter',
        'click .btn-create': '_onBtnCreateClick',
        'click .btn-duplicate': '_onBtnDuplicateClick',
        'click .btn-move': '_onBtnMoveClick',
        'click .breadcrumb a[data-controller-id]': '_onBreadcrumbItemClick',
        'click .o_article_caret': '_onFold',
        'click .o_article_name': '_onOpen',
        'click .o_article_create': '_onBtnArticleCreateClick',
        'click .o_section_create': '_onBtnSectionCreateClick',
        'click .o_knowledge_share_panel': '_preventDropdownClose',
        'click .o_knowledge_more_options_panel': '_preventDropdownClose',
        'show.bs.dropdown a.o_article_emoji': '_onEmojiPickerShow',
        'hide.bs.dropdown a.o_article_emoji': '_onEmojiPickerHide',
    }),
    /**
     * @override
     */
    init: function (parent, state, params) {
        this._super(...arguments);
        this.breadcrumbs = params.breadcrumbs;
        /**
         * Manually set values for the chatter props as it is custom handled
         * and not loaded with the view (oe_chatter is not used in Knowledge,
         * the chatter is only rendered when the user clicks on the button).
         */
        this.chatterFields = {
            // `knowledge.article` has `mail.activity.mixin`
            hasActivities: true,
            hasFollowers: true,
            hasMessageIds: true,
        };
    },
    /**
     * Called when the chatter triggers a reload on the Form view with the
     * param 'keepChanges=true'. In this case, we only need to update the
     * chatter.
     *
     * @returns {Promise}
     */
    updateChatter: function () {
        if (this._chatterContainerComponent && this.state.res_id) {
            const props = this._makeChatterContainerProps();
            return this._chatterContainerComponent.update(props);
        }
        this._closeChatter();
        return Promise.resolve();
    },
    /**
     * @private
     */
    _closeChatter: function () {
        this._chatterContainerTarget.replaceChildren();
        if (this._chatterContainerComponent) {
            this._chatterContainerComponent.destroy();
            this._chatterContainerComponent = undefined;
        }
    },
    /**
     * @param {Event} event
     */
    _onBreadcrumbItemClick: function (event) {
        const $target = $(event.target);
        this.trigger_up('breadcrumb_clicked', {
            controllerID: $target.data('controller-id'),
        });
    },
    /**
     * Callback function called when the user clicks on the '+' sign of an article
     * list item. The callback function will create a new article under the target article.
     * @param {Event} event
     */
    _onBtnArticleCreateClick: function (event) {
        const $target = $(event.currentTarget);
        const $li = $target.closest('li');
        this.trigger_up('create', {
            target_parent_id: $li.data('article-id')
        });
    },
    /**
     * @param {Event} event
     */
    _onBtnChatterClick: function (event) {
        const $chatter = $('.o_knowledge_chatter');
        $chatter.toggleClass('d-none');
        $('.btn-chatter').toggleClass('active');
    },
    /**
     * @param {Event} event
     */
    _onBtnCreateClick: function (event) {
        this.trigger_up('create', {
            category: 'private'
        });
    },
    /**
     * @param {Event} event
     */
    _onBtnDuplicateClick: function (event) {
        event.preventDefault();
        this.trigger_up('duplicate', {});
    },
    /**
     * @param {Event} event
     */
    _onBtnMoveClick: function (event) {
        event.preventDefault();
        this.trigger_up('open_move_to_modal', {});
    },
    /**
     * Callback function called when the user clicks on the '+' sign of a section
     * (workspace, private, shared). The callback function will create a new article
     * on the root of the target section.
     * @param {Event} event
     */
    _onBtnSectionCreateClick: function (event) {
        const $target = $(event.currentTarget);
        const $section = $target.closest('.o_section');
        this.trigger_up('create', {
            category: $section.data('section')
        });
    },
    /**
     * Update the btn-chatter appearance and hide the chatter section in the
     * view. Closes the chatter.
     *
     * @private
     */
    _onCloseChatter: function () {
        this.el.querySelector('.o_knowledge_chatter').classList.add('d-none');
        this.el.querySelector('.btn-chatter').classList.remove('active');
        this._closeChatter();
    },
    /**
     * Hide the container of the emoji picker since it also contains a page
     * blocker (to force the user to close the emoji picker before continuing
     * to use the page).
     *
     * @private
     */
    _onEmojiPickerHide: function () {
        this.emojiPickerContainer.classList.remove('show');
    },
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
    _onEmojiPickerShow: function (ev) {
        const dropdown = globalThis.Dropdown.getInstance(ev.currentTarget);
        // the show class on the container allows to display the page blocker
        this.emojiPickerContainer.classList.add('show');
        if (!dropdown._menu) {
            dropdown._menu = this.emojiPickerContainer.querySelector('.dropdown-menu');
        }
    },
    /**
     * Opens the selected record.
     * @param {Event} event
     */
    _onOpen: async function (event) {
        event.stopPropagation();
        const $li = $(event.target).closest('li');
        this.do_action('knowledge.ir_actions_server_knowledge_home_page', {
            stackPosition: 'replaceCurrentAction',
            additional_context: {
                res_id: $li.data('article-id')
            }
        });
    },
    /**
     * Update tbe btn-chatter appearance and show the chatter section in the
     * view. Open the chatter.
     *
     * @private
     * @param {OdooEvent} ev
     */
    _onOpenChatter: function (ev) {
        ev.stopPropagation();
        if (this.state.res_id) {
            this.el.querySelector('.o_knowledge_chatter').classList.remove('d-none');
            this.el.querySelector('.btn-chatter').classList.add('active');
            this._renderChatter();
        }
    },
    /**
     * By default, Bootstrap closes automatically the dropdown menu when the user
     * clicks inside it. To avoid that behavior, we will add a new event listener
     * on the dropdown menu that will prevent the click event from bubbling up and
     * triggering the listener closing the dropdown menu.
     * @param {Event} event
     */
    _preventDropdownClose: function (event) {
        event.stopPropagation();
    },
    _renderArticleEmoji: function () {
        const { data } = this.state;
        const $dropdown = this.$('.o_knowledge_icon > .o_article_emoji_dropdown');
        $dropdown.attr('data-article-id', this.state.res_id);
        $dropdown.find('.o_article_emoji').text(data.icon || '');
    },
    /**
     * Renders the breadcrumb
     */
    _renderBreadcrumb: function () {
        const items = this.breadcrumbs.map(payload => {
            return QWeb.render('knowledge.knowledge_breadcrumb_item', { payload });
        });
        this.$('.breadcrumb').prepend(items);
    },
    /**
     * Render and mount the chatter of the current record.
     *
     * @private
     * @returns {Promise}
     */
    _renderChatter: function () {
        this._closeChatter();
        return this.initChatter();
    },
    /**
     * @private
     * @returns {Promise}
     */
    _renderEmojiPicker: function () {
        this.emojiPickerContainer = this.el.querySelector('.o_knowledge_emoji_picker_container');
        this.emojiPicker = new EmojiPickerWidget(this);
        return this.emojiPicker.appendTo($(this.emojiPickerContainer));
    },
    /**
     * Renders the permission panel
     */
    _renderPermissionPanel: function () {
        this.$('.btn-share').one('click', event => {
            const $container = this.$('.o_knowledge_permission_panel');
            const panel = new PermissionPanelWidget(this, {
                article_id: this.state.data.id,
                user_permission: this.state.data.user_permission
            });
            panel.attachTo($container);
        });
    },
    /**
     * @override
     * @returns {Promise}
     */
    _renderView: async function () {
        const result = await this._super.apply(this, arguments);
        this._renderBreadcrumb();
        await this._renderTree(this.state.res_id, '/knowledge/tree_panel');
        this._renderArticleEmoji();
        this._renderPermissionPanel();
        this._setResizeListener();
        await this._renderEmojiPicker();
        this._chatterContainerTarget = this.el.querySelector('.o_knowledge_chatter_container');
        return result;
    },
    /**
     * @param {integer} id - Article id
     * @param {String} unicode
     */
    _setEmoji: function (id, emoji) {
        const emojis = this.$(`.o_article_emoji_dropdown[data-article-id="${id}"] > .o_article_emoji`);
        emojis.text(emoji || '📄');
    },
    /**
     * Setup the emoji picker listener(s) to open it when clicking on an emoji
     *
     * @param {JQuery} $emojiContainer element containing emoji_dropdown
     *                 which need a click handler to open the
     */
    _setEmojiPickerListener: function ($emojiContainer) {
        $emojiContainer = $emojiContainer || this.$el;
        $emojiContainer.find('.o_article_emoji_dropdown').on('click', async event => {
            this.emojiPicker.setArticleId(parseInt(event.currentTarget.dataset.articleId));
        });
    },
    /**
     * Enables the user to resize the aside block.
     * Note: When the user grabs the resizer, a new listener will be attached
     * to the document. The listener will be removed as soon as the user releases
     * the resizer to free some resources.
     */
    _setResizeListener: function () {
        /**
         * @param {PointerEvent} event
         */
        const onPointerMove = _.throttle(event => {
            event.preventDefault();
            this.el.style.setProperty('--default-sidebar-size', `${event.pageX}px`);
        }, 100);
        /**
         * @param {PointerEvent} event
         */
        const onPointerUp = event => {
            $(document).off('pointermove', onPointerMove);
        };
        const $resizer = this.$('.o_knowledge_article_form_resizer');
        $resizer.on('pointerdown', event => {
            event.preventDefault();
            $(document).on('pointermove', onPointerMove);
            $(document).one('pointerup', onPointerUp);
        });
    },
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
     */
    _setTreeListener: function () {
        const $sortable = this.$('.o_tree');
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
                    this.$('section[data-section="shared"]').addClass('o_no_root_placeholder');
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
                this.$('.o_knowledge_empty_info:only-child').removeClass('d-none');
                const confirmMove = () => {
                    const id = $li.data('parent-id');
                    if (typeof id !== 'undefined') {
                        const $parent = this.$(`.o_article[data-article-id="${id}"]`);
                        if (!$parent.children('ul').is(':parent')) {
                            const $caret = $parent.find('> .o_article_handle > .o_article_caret');
                            $caret.remove();
                        }
                    }
                    if ($parent.length > 0) {
                        const $handle = $parent.children('.o_article_handle:first');
                        if ($handle.children('.o_article_caret').length === 0) {
                            const $caret = $(QWeb.render('knowledge.knowledge_article_caret', {}));
                            $handle.prepend($caret);
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
                    const $sharedSection = this.$('section[data-section="shared"]');
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
                    this.$('section[data-section="shared"]').removeClass('o_no_root_placeholder');
                    $sortable.sortable('enable');
                    this.$('.o_knowledge_empty_info').addClass('d-none');
                    this.$('.o_knowledge_empty_info:only-child').removeClass('d-none');
                };
                // The stop method may be called before the library calls
                // isAllowed (bug), so it has to be called again as a failsafe.
                if ($sortable.data('mjsNestedSortable').options.isAllowed(ui.item, undefined, ui.item)) {
                    this.trigger_up('move', {...data,
                        onSuccess: confirmMove,
                        onReject: rejectMove,
                    });
                } else {
                    rejectMove();
                }
            },
        });

        // Allow drag and drop between sections:

        this.$('section[data-section="workspace"] .o_tree').nestedSortable(
            'option',
            'connectWith',
            'section[data-section="private"] .o_tree, section[data-section="shared"] .o_tree'
        );
        this.$('section[data-section="private"] .o_tree').nestedSortable(
            'option',
            'connectWith',
            'section[data-section="workspace"] .o_tree, section[data-section="shared"] .o_tree'
        );
        // connectWith both workspace and private sections:
        this.$('section[data-section="shared"] .o_tree').nestedSortable(
            'option',
            'connectWith',
            'section[data-section="workspace"] .o_tree, section[data-section="private"] .o_tree'
        );
    },
});

export {
    KnowledgeArticleFormRenderer,
};
