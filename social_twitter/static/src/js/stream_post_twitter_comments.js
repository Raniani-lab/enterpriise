odoo.define('social.StreamPostTwitterComments', function (require) {
    var core = require('web.core');
    var _t = core._t;
    var QWeb = core.qweb;

    var StreamPostComments = require('@social/js/stream_post_comments')[Symbol.for("default")];

    var StreamPostTwitterComments = StreamPostComments.extend({
        MAX_ALLOWED_REPLIES: 3,

        init: function (parent, options) {
            this.accountId = options.accountId;
            this.streamId = options.streamId;
            this.hasMoreComments = options.hasMoreComments;
            this.page = 1;
            this.allComments = options.allComments || [];
            this.commentsCount = options.commentsCount;
            this.comments = this.allComments.slice(0, this.commentsCount);
            this.allCommentsFlatten = this.allComments.reduce((result, currentComment) => {
                if (currentComment.comments) {
                    const subComments = currentComment.comments.data;
                    result.push(currentComment, ...subComments);
                } else {
                    result.push(currentComment);
                }
                return result;
            }, []);
            this.mediaType = 'twitter';
            this.twitterTweetId = options.originalPost.twitterTweetId;

            this.options = _.defaults(options || {}, {
                title: _t('Twitter Comments'),
                commentName: _t('tweet'),
                comments: this.comments
            });

            this._super.apply(this, arguments);
        },

        willStart: function () {
            var self = this;

            var superDef = this._super.apply(this, arguments);
            var pageInfoDef = this._rpc({
                model: 'social.account',
                method: 'read',
                args: [this.accountId, ['name', 'twitter_user_id', 'social_account_handle']],
            }).then(function (result) {
                self.accountName = result[0].name;
                self.twitterUserId = result[0].twitter_user_id;
                self.twitterUserScreenName = result[0].social_account_handle;

                return Promise.resolve();
            });

            return Promise.all([superDef, pageInfoDef]);
        },

        //--------------------------------------------------------------------------
        // Public
        //--------------------------------------------------------------------------

        getAuthorPictureSrc: function (comment) {
            if (comment) {
                return comment.from.profile_image_url_https;
            } else {
                return _.str.sprintf('/web/image/social.account/%s/image/48x48', this.accountId);
            }
        },

        getLikesClass: function () {
            return "fa-heart";
        },

        getCommentLink: function (comment) {
            return _.str.sprintf("https://www.twitter.com/%s/statuses/%s", comment.from.id, comment.id);
        },

        getAuthorLink: function (comment) {
            return _.str.sprintf("https://twitter.com/intent/user?user_id=%s", comment.from.id);
        },

        isCommentDeletable: function (comment) {
            return comment.from.id === this.twitterUserId;
        },

        getAddCommentEndpoint: function () {
            return _.str.sprintf('/social_twitter/%s/comment', this.streamId);
        },

        getDeleteCommentEndpoint: function () {
            return '/social_twitter/delete_tweet';
        },

        isCommentEditable: function () {
            return false;
        },

        isCommentAuthor: function (comment) {
            return this.twitterUserId === comment.from.id;
        },

        isPostAuthor: function (post) {
            return this.twitterUserId === post.twitterAuthorId;
        },

        showMoreComments: function (result) {
            return this.page * this.commentsCount < this.allComments.length;
        },

        //--------------------------------------------------------------------------
        // Handlers
        //--------------------------------------------------------------------------

        _onLikeComment: function (ev) {
            ev.preventDefault();

            var $target = $(ev.currentTarget);
            var userLikes = $target.data('userLikes');
            this._rpc({
                route: _.str.sprintf('social_twitter/%s/like_tweet', this.streamId),
                params: {
                    tweet_id: $target.data('commentId'),
                    like: !userLikes
                }
            });

            $target.toggleClass('o_social_comment_user_likes');
            this._updateLikesCount($target);
        },

        _onLoadMoreComments: function (ev) {
            var self = this;
            ev.preventDefault();

            this.page += 1;
            var start = (this.page - 1) * this.commentsCount;
            var end = start + this.commentsCount;
            var $moreComments = $(QWeb.render("social.StreamPostCommentsWrapper", {
                widget: this,
                comments: this.allComments.slice(start, end)
            }));
            self.$('.o_social_comments_messages').append($moreComments);

            if (end >= this.allComments.length) {
                self.$('.o_social_load_more_comments').hide();
            }
        },

        //--------------------------------------------------------------------------
        // Override
        //--------------------------------------------------------------------------

        /**
         * Check if we do not already answer too many times to the same tweet
         * to not spam the Twitter users.
         */
        _addComment: function ($textarea, isCommentReply, commentId, isEdit) {
            const tweetId = isCommentReply ? commentId : this.twitterTweetId;
            const existingAnswers = this.allCommentsFlatten.filter((comment) =>
                comment.from && comment.from.screen_name === this.twitterUserScreenName
                && comment.in_reply_to_status_id_str === tweetId
            );

            if (existingAnswers.length >= this.MAX_ALLOWED_REPLIES) {
                this._showSpamMessage($textarea);
                return;
            }

            return this._super.apply(this, arguments).then((comment) => {
                this.allCommentsFlatten.push(comment);

                if (existingAnswers.length >= this.MAX_ALLOWED_REPLIES - 1) {
                    this._showSpamMessage($textarea);
                }
            });
        },

        /**
          * Display the spam warning message bellow the textarea.
          **/
        _showSpamMessage($textarea) {
            $textarea
                .closest('.o_social_write_reply')
                .find('.o_social_textarea_message')
                .text(_t("You can comment only three times a tweet as it may be considered as spamming by Twitter"))
                .addClass('text-danger')
                .removeClass('text-600');

            $textarea.prop('disabled', true);

            $textarea
                .closest('.o_social_write_reply')
                .find('.o_social_comment_controls')
                .css('pointer-events', 'none');
        },

    });

    return StreamPostTwitterComments;
});
