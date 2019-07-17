odoo.define('social.social_stream_post_kanban_renderer', function (require) {
"use strict";

var core = require('web.core');
var KanbanColumn = require('web.KanbanColumn');
var KanbanRenderer = require('web.KanbanRenderer');
var QWeb = core.qweb;

/**
 * Simple override in order to provide a slightly modified template that shows the
 * social.media icon before the social.stream name (if grouped by stream_id).
 */
var StreamPostKanbanColumn = KanbanColumn.extend({
    template: 'social.KanbanView.Group'
});

var StreamPostKanbanRenderer = KanbanRenderer.extend({
    config: _.extend({}, KanbanRenderer.prototype.config, {
        KanbanColumn: StreamPostKanbanColumn
    }),

    /**
     * We use a little trick here.
     * We add an element BEFORE this $el because the kanban view has a special type of content
     * disposition (flex with 'row' flex-direction) that makes it impossible to add element
     * on top of it that takes the full width of the screen.
     *
     * Indeed, if we do that, it makes it so that when the columns exceeds the width of the screen,
     * they will be pushed under the others instead of extending the width by adding a scrollbar.
     *
     * In other words:
     *
     * Screen size:
     *
     * <------------------>
     *
     * We want this:
     *
     * --------------------
     *     dashboard
     * --------------------
     * Stream: 1  Stream: 2  Stream: 3
     * Post 1     Post 1     Post 1
     * Post 2     Post 2     Post 2
     * <------- (scrollbar) --------->
     *
     *
     * If we add the dashboard without putting it before this.$el, we get this:
     *
     * --------------------
     *     dashboard
     * --------------------
     * Stream: 1  Stream: 2
     * Post 1     Post 1
     * Post 2     Post 2
     *
     * Stream: 3
     * Post 1
     * Post 2
     * <- (no scrollbar) ->
     *
     * In addition, we add a special class to 'o_content' to get the right background color
     * for the dashboard when the user scrolls right.
     */
    start: function () {
        var self = this;
        this.$before = $('<section/>', {class: 'o_social_stream_post_kanban_before d-flex flex-nowrap border-bottom'});
        return this._super.apply(this, arguments).then(function () {
            self.$el.before(self.$before);
            self.$el.closest('.o_content').addClass('o_social_stream_post_kanban_view_wrapper bg-100');
        });
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Our socialAccountsStats cache variable need to be kept between state updates
     *
     * @override
     */
    _setState: function () {
        var socialAccountsStats = this.state.socialAccountsStats;
        this._super.apply(this, arguments);
        this.state.socialAccountsStats = socialAccountsStats;
    },

    /**
     * Overridden to:
     * - display a custom dashboard on top of the kanban ;
     * - handle custom "no content helper" messages.
     * - render popover helpers
     *
     * @override
     * @private
     * @returns {Promise}
     */
    _render: function () {
        var self = this;
        return this._super.apply(this, arguments).then(function () {
            self.$before.empty();
            if (self.state.socialAccountsStats && self.state.socialAccountsStats.length !== 0) {
                var $socialAccountsStats = QWeb.render(
                    'social.AccountsStats',
                    {socialAccounts: self.state.socialAccountsStats}
                );

                self.$before.append($socialAccountsStats);
                self.$before.find('[data-toggle="popover"]').popover({
                    trigger: 'hover'
                });
            }
        });
    },

    /**
     * Overridden because we want to show it even when 'this.state.isGroupedByM2ONoColumn' is true
     * This will be the default state when the user lands on the kanban view for this first time.
     * (Since it's grouped by stream by default.)
     *
     * @private
     * @override
     */
    _toggleNoContentHelper: function (remove) {
        var displayNoContentHelper =
            !remove &&
            !this._hasContent() &&
            !!this.noContentHelp &&
            !(this.quickCreate && !this.quickCreate.folded);

        var $noContentHelper = this.$('.o_view_nocontent');

        if (displayNoContentHelper && !$noContentHelper.length) {
            this.$el.append(this._renderNoContentHelper());
        }
        if (!displayNoContentHelper && $noContentHelper.length) {
            $noContentHelper.remove();
        }
    }
});

return StreamPostKanbanRenderer;

});
