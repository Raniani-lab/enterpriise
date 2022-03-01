odoo.define('social_crm.social_stream_post_comments', function (require) {

var StreamPostComments = require('social.social_post_kanban_comments');

/**
 * Extension of the social_post_kanban_comment to support lead generation.
 * It allows to decide when to display the Generate Lead option for comment and post.
 */
var StreamPostCommentsGenerateLead = StreamPostComments.include({

    events: _.extend({}, StreamPostComments.prototype.events, {
        'click .o_social_generate_lead_comment': '_onGenerateLeadComment',
        'click .o_social_generate_lead_post': '_onGenerateLeadPost',
    }),

    /**
     * @override
     */
    isCommentManageable: function (comment) {
        return this._super(...arguments) || this.isCommentConvertibleToLead(comment);
    },

    isCommentConvertibleToLead: function (comment) {
        return !this.isCommentAuthor(comment);
    },

    isPostConvertibleToLead: function (post) {
        return  !this.isPostAuthor(post);
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * Method called when generating a social.lead from a post comment.
     * It retrieves necessary data for the lead creation and open the social.post.to.lead wizard.
     *
     * As the clicked DOM element only has the "commentId", we need to loop through "this.comments"
     * (and inner comments) to find the "full" object containing the necessary data.
     *
     * @param {MouseEvent} ev
     */
    _onGenerateLeadComment: async function (ev) {
        ev.preventDefault();
        var $targetComment = $(ev.currentTarget).closest('.o_social_comment');

        var commentId = $targetComment.data('commentId');
        // accumulate comments and sub-comments into a single variable
        var allComments = this.comments;
        this.comments.forEach(comment => {
            if (comment.comments && comment.comments.data) {
                allComments = allComments.concat(comment.comments.data)
            }
        });
        // find the target comment based on its id
        var targetComment = allComments.find(comment => String(comment.id) === String(commentId));
        if (!targetComment) {
            return false;
        }

        this.do_action("social_crm.social_post_to_lead_action", {
            additional_context: {
                default_conversion_source: 'comment',
                default_social_stream_post_id: this.originalPost.postId,
                default_social_account_id: this.accountId,
                default_author_name: targetComment.from.name,
                default_post_content: this._formatPost(targetComment.message),
                // expected datetime format by the server
                // as social comments are not stored as records, we need to do some manual formatting
                default_post_datetime: moment(targetComment.created_time).format('YYYY-MM-DD HH:mm:ss'),
                default_post_link: this.originalPost.postLink
            }
        });
    },

    /**
     * Method called when generating a social.lead from a social.stream.post.
     * It opens the social.post.to.lead wizard and pass it the social_post reference as.
     * The various information (author, date, ...) will be deduced by the wizard using
     * the social_post reference.
     *
     * We also give the wizard the content formatted with "_formatPost", which will add support for
     * @mentions, #references, and links.
     *
     * @param {MouseEvent} ev
     */
    _onGenerateLeadPost: async function (ev) {
        ev.preventDefault();

        this.do_action("social_crm.social_post_to_lead_action", {
            additional_context: {
                default_conversion_source: 'stream_post',
                default_social_stream_post_id: this.originalPost.postId,
                default_social_account_id: this.accountId,
                default_post_content: this._formatPost(this.originalPost.postMessage),
            }
        });
    },
});

return StreamPostCommentsGenerateLead;

});
