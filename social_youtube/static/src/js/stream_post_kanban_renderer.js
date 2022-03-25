odoo.define('social.social_youtube_stream_post_kanban_renderer', function (require) {
"use strict";

const StreamPostKanbanRenderer = require('social.social_stream_post_kanban_renderer');
StreamPostKanbanRenderer.include({
    /**
     * We do not want to display audience information for Youtube account.
     *
     * @param {Object} socialAccount  social.account search_read data
     * @private
     * @override
     */
    _hasAudience: function (socialAccount) {
        return socialAccount.media_type !== 'youtube' && this._super.apply(this, arguments);
    },

    /**
     * We do not want to display engagement information for Youtube account.
     *
     * @param {Object} socialAccount  social.account search_read data
     * @private
     * @override
     */
    _hasEngagement: function (socialAccount) {
        return socialAccount.media_type !== 'youtube' && this._super.apply(this, arguments);
    },

    /**
     * We do not want to display stories information for Youtube account.
     *
     * @param {Object} socialAccount  social.account search_read data
     * @private
     * @override
     */
    _hasStories: function (socialAccount) {
        return socialAccount.media_type !== 'youtube' && this._super.apply(this, arguments);
    },
});

return StreamPostKanbanRenderer;

});
