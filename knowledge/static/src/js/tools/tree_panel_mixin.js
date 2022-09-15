/** @odoo-module */

export default {
    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------
    /**
     * Initializes the drag-and-drop behavior of the favorite.
     * Once this function is called, the user will be able to reorder their favorites.
     * When a favorite is reordered, `this.resequenceFavorites` will be called
     * and the drag-and-drop behavior will be deactivated while the request is pending.
     * - If the rpc call succeeds, the drag-and-drop behavior will be reactivated.
     * - If the rpc call fails, the change will be undo and the drag-and-drop
     *   behavior will be reactivated.
     * Unfortunately, `sortable` can only restore one transformation. Disabling
     * the drag-and-drop behavior will ensure that the list structure can be restored
     * if something went wrong.
     */
    _setTreeFavoriteListener: function () {
        const $sortable = $('.o_tree_favorite');
        $sortable.sortable({
            axis: 'y',
            handle: '.o_article_handle',
            items: 'li:not(.o_article_tree_child)',
            opacity: 0.6,
            placeholder: 'ui-sortable-placeholder',
            tolerance: 'intersect',
            helper: 'clone',
            cursor: 'grabbing',
            cancel: '.o_article_tree_child',
            scrollSpeed: 6,
            delay: 150,
            distance: 10,
            /**
             * @param {Event} event
             * @param {Object} ui
             */
            stop: async (event, ui) => {
                const favoriteIds = $sortable.find('.o_article:not(.o_article_tree_child)').map(function () {
                    return $(this).data('favorite-article-id');
                }).get();
                $sortable.sortable('disable');
                try {
                    await this._resequenceFavorites(favoriteIds);
                    $sortable.sortable('enable');
                } catch {
                    $sortable.sortable('cancel');
                    $sortable.sortable('enable');
                }
            },
        });
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
        this._fold($(event.currentTarget));
    },
    _fold: async function ($button) {
       const $icon = $button.find('i');
       const $li = $button.closest('li');
       const articleId = $li.data('articleId').toString();
       if ($icon.hasClass('fa-caret-down')) {
           // Hiding ul breaks nestedSortable, so move children
           // inside sibling to not lose its content
           const $ul = $li.find('> ul');
           $li.find('> div').append($ul.detach().hide());
           this._removeUnfolded(articleId);
           $icon.removeClass('fa-caret-down');
           $icon.addClass('fa-caret-right');
       } else {
           const $ul = $li.find('> div > ul');
           if ($ul.length) {
               // Show children content stored in sibling
               $li.append($ul.detach().show());
           } else {
               const children = await this._fetchChildrenArticles($li.data('articleId')); 
               const $newUl = $('<ul/>').append(children);
               $li.append($newUl);
           }
           this._addUnfolded(articleId);
           $icon.removeClass('fa-caret-right');
           $icon.addClass('fa-caret-down');  
       } 
    },

    /**
     * Add an article id to the list of unfolded articles ids in the cache
     * @param {string} articleId - Id of the article to add
     */
    _addUnfolded: function (articleId) {
        let unfoldedArticles = localStorage.getItem('unfoldedArticles');
        unfoldedArticles = unfoldedArticles ? unfoldedArticles.split(";") : [];
        if (unfoldedArticles.indexOf(articleId) === -1) {
            unfoldedArticles.push(articleId);
            localStorage.setItem('unfoldedArticles', unfoldedArticles.join(";"));
        }
    },
    /**
     * Remove an article id from the list of unfolded articles ids in the cache
     * @param {string} articleId - Id of the article to remove
     */
     _removeUnfolded: function (articleId) {
         let unfoldedArticles = localStorage.getItem('unfoldedArticles');
         unfoldedArticles = unfoldedArticles ? unfoldedArticles.split(";") : [];
         if (unfoldedArticles.indexOf(articleId) !== -1) {
             unfoldedArticles.splice(unfoldedArticles.indexOf(articleId), 1);
             localStorage.setItem('unfoldedArticles', unfoldedArticles.join(";"));
         }
     }
};

