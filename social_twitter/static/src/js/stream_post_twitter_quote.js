odoo.define('social.StreamPostTwitterQuote', function (require) {
"use strict";

const Dialog = require('web.Dialog');
const dom = require('web.dom');
const emojis = require('@mail/js/emojis')[Symbol.for("default")];
const MailEmojisMixin = require('@mail/js/emojis_mixin')[Symbol.for("default")];
const SocialPostFormatterMixin = require('social.post_formatter_mixin');
const { _t } = require('web.core');
const { Markup } = require('web.utils');

const StreamPostTwitterQuote = Dialog.extend(MailEmojisMixin, SocialPostFormatterMixin, {
    template: 'social_twitter.quote_modal',
    events: {
        'click .o_social_reply_container .o_mail_emoji': '_onEmojiClick',
        'click .o_social_comment_add_image': '_onImageAdd',
        'click .o_social_comment_remove_image': '_onImageRemove',
        'change .o_input_file': '_onImageChange',
    },

    /**
     * @override
     */
    init: function (parent, options) {
        this.options = _.defaults(options || {}, {
            title: _t('Quote a Tweet'),
            size: 'medium',
            buttons: [{
                classes: 'btn-primary',
                text: _t('Post'),
                click: this._onConfirmQuoteTweet.bind(this)
            }, {
                text: _t('Cancel'),
                close: true
            }]
        });

        this.originalPost = options.originalPost;
        this.emojis = emojis;
        this.parent = parent;
        this._super.apply(this, arguments);
    },

    /**
     * @override
     */
    start: function () {
        return this._super.apply(this, arguments).then(() => {
            dom.autoresize(this.$('textarea').first(), {
                parent: this,
                min_height: 60
            });
        });
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    canAddImage: function () {
        return true;
    },

    getAuthorPictureSrc: function () {
        const id = this.originalPost.accountId;
        return _.str.sprintf('/web/image/social.account/%s/image/48x48', id);
    },

    isPostConvertibleToLead: function () {
        return false;
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    _onConfirmQuoteTweet: async function () {
        const form = this.$el.find('form').first()[0];
        const formData = new FormData(form);
        formData.append('csrf_token', odoo.csrf_token);
        formData.append('tweet_id', this.originalPost.twitterTweetId);
        formData.append('stream_id', this.originalPost.streamId);
        const url = _.str.sprintf('social_twitter/%s/quote', this.originalPost.streamId);
        $.ajax(url, {
            data: formData,
            processData: false,
            contentType: false,
            type: 'POST'
        }).done(result => {
            result = JSON.parse(result);
            if (result === true) {
                this.trigger_up('refresh');
            } else if (result.error) {
                this.displayNotification({
                    title: _t('Error'),
                    message: result.error,
                    type: 'danger'
                });
            }
        }).fail(() => {
            this.displayNotification({
                type: 'warning',
                message: _t('Error while sending the data to the server.')
            });
        }).always(() => {
            this.close();
        });
    },

    /**
     * @param {Event} ev 
     */
    _onImageAdd: function (ev) {
        ev.preventDefault();
        $(ev.currentTarget).closest('.o_social_write_reply').find('.o_input_file').first().click();
    },

    /**
     * @param {Event} ev 
     */
    _onImageChange: async function (ev) {
        const file = ev.target.files[0];
        if (!file) {
            return;
        }
        const $preview = $(ev.currentTarget).closest('.o_social_write_reply').find('.o_social_comment_image_preview');
        const $img = $preview.find('img');
        $img.attr('src', URL.createObjectURL(file));
        $img.on('load', () => {
            URL.revokeObjectURL($img.attr('src'));
        });
        $preview.removeClass('d-none');
    },

    /**
     * @param {Event} ev
     */
    _onImageRemove: function (ev) {
        const $target = $(ev.currentTarget);
        const $replyEl = $target.closest('.o_social_write_reply');
        $replyEl.find('.o_social_comment_image_preview').addClass('d-none');
        $replyEl.find('.o_input_file').val('');
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _formatCommentStreamPost: function (message) {
        return Markup(this._formatPost(message));
    },

    _getTargetTextElement: function ($emoji) {
        return $emoji.closest('.o_social_write_reply').find('textarea').get(0);
    },
});

return StreamPostTwitterQuote;

});
