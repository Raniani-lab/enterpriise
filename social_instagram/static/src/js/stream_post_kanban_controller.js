odoo.define('social_instagram.social_stream_post_kanban_controller', function (require) {
"use strict";

var StreamPostKanbanController = require('social.social_stream_post_kanban_controller');
var StreamPostInstagramComments = require('social.social_instagram_post_comments');

StreamPostKanbanController.include({
    events: _.extend({}, StreamPostKanbanController.prototype.events, {
        'click .o_social_instagram_comments': '_onInstagramCommentsClick',
    }),

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    _onInstagramCommentsClick: function (ev) {
        var $target = $(ev.currentTarget);
        var postId = $target.data('postId');

        this._rpc({
            route: '/social_instagram/get_comments',
            params: {
                stream_post_id: postId
            }
        }).then((result) => {
            new StreamPostInstagramComments(
                this,
                {
                    postId: postId,
                    accountId: $target.data('instagramAccountId'),
                    originalPost: $target.data(),
                    comments: result.comments,
                    nextRecordsToken: result.nextRecordsToken
                }
            ).open();
        });
    },
});

return StreamPostKanbanController;

});
