odoo.define('social_twitter.social_stream_post_kanban_controller', function (require) {
"use strict";

var StreamPostKanbanController = require('social.social_stream_post_kanban_controller');
var StreamPostTwitterComments = require('social.StreamPostTwitterComments');
var StreamPostTwitterQuote = require('social.StreamPostTwitterQuote');
var { _t } = require('web.core');

StreamPostKanbanController.include({
    events: _.extend({}, StreamPostKanbanController.prototype.events, {
        'click .o_social_twitter_comments': '_onTwitterCommentsClick',
        'click .o_social_twitter_likes': '_onTwitterTweetLike',
        'click .o_social_twitter_retweet': '_onTwitterRetweet',
        'click .o_social_twitter_quote': '_onTwitterQuote',
    }),
    custom_events: _.extend({}, StreamPostKanbanController.prototype.custom_events, {
        'refresh': '_triggerRefreshNow'
    }),
    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    _onTwitterCommentsClick: function (ev) {
        var self = this;
        var $target = $(ev.currentTarget);

        var postId = $target.data('postId');
        this._rpc({
            route: '/social_twitter/get_comments',
            params: {
                stream_post_id: postId
            }
        }).then(function (result) {
            new StreamPostTwitterComments(
                self,
                {
                    commentsCount: self.commentsCount,
                    postId: postId,
                    originalPost: $target.data(),
                    streamId: $target.data('streamId'),
                    accountId: $target.data('twitterAccountId'),
                    allComments: result.comments
                }
            ).open();
        });
    },

    /**
     * @param {Event} ev
     */
    _onTwitterQuote: function (ev) {
        ev.preventDefault();
        const $target = $(ev.currentTarget);
        const modal = new StreamPostTwitterQuote(this, {
            originalPost: $target.data()
        });
        modal.open();
    },

    _onTwitterTweetLike: function (ev) {
        ev.preventDefault();

        var $target = $(ev.currentTarget);
        var userLikes = $target.data('userLikes');
        this._rpc({
            route: _.str.sprintf('social_twitter/%s/like_tweet', $target.data('streamId')),
            params: {
                tweet_id: $target.data('twitterTweetId'),
                like: !userLikes
            }
        });

        this._updateLikesCount($target);
        $target.toggleClass('o_social_twitter_user_likes');
    },

    /**
     * @param {Event} ev
     */
    _onTwitterRetweet: function (ev) {
        ev.preventDefault();
        const $target = $(ev.currentTarget);
        let url = 'social_twitter/' + $target.data('stream-id');
        url += ($target.data('user-retweet') ? '/retweet' : '/unretweet')
        this._rpc({
            route: url,
            params: {
                tweet_id: $target.data('twitter-tweet-id'),
                stream_id: $target.data('stream-id')
            }
        }).then(result => {
            result = JSON.parse(result);
            if (result === true) {
                const $card = $target.closest('.o_social_stream_post_message');
                const $icon = $card.find('.o_social_twitter_retweet_icon i');
                $icon.toggleClass('active', $target.data('user-retweet'));
                this._onRefreshNow(true);
            } else if (result.error) {
                this.displayNotification({
                    title: _t('Error'),
                    message: result.error,
                    type: 'danger'
                });
            }
        })
    },

    _triggerRefreshNow: function () {
        this._onRefreshNow(true);
    },
});

return StreamPostKanbanController;

});
