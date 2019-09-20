odoo.define('social.social_stream_post_kanban_view', function (require) {
"use strict";

var KanbanView = require('web.KanbanView');
var StreamPostKanbanController = require('social.social_stream_post_kanban_controller');
var StreamPostKanbanModel = require('social.social_stream_post_kanban_model');
var StreamPostKanbanRenderer = require('social.social_stream_post_kanban_renderer');
var viewRegistry = require('web.view_registry');

var StreamPostKanbanView = KanbanView.extend({
    icon: 'fa-share-alt',
    config: _.extend({}, KanbanView.prototype.config, {
        Model: StreamPostKanbanModel,
        Renderer: StreamPostKanbanRenderer,
        Controller: StreamPostKanbanController,
    }),

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * On first load of the kanban view, we need to refresh both the streams and the accounts stats
     * BEFORE loading the kanban records.
     *
     * @override
     */
    _loadData: function (model) {
        var self = this;
        var superArguments = arguments;
        var superMethod = this._super;

        return Promise.all([
            model._refreshStreams(),
            model._refreshAccountsStats().then(function (socialAccountsStats) {
                return socialAccountsStats;
            })
        ]).then(function (results) {
            var socialAccountsStats = results[1];
            return superMethod.apply(self, superArguments).then(function (state) {
                state.socialAccountsStats = socialAccountsStats;
                return state;
            });
        });
    },
});

viewRegistry.add('social_stream_post_kanban_view', StreamPostKanbanView);

return StreamPostKanbanView;

});
