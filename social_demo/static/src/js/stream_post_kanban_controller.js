/** @odoo-module **/

import StreamPostKanbanController from 'social.social_stream_post_kanban_controller';

StreamPostKanbanController.include({
    /**
     * @override
     * @param {boolean} forceStreamRenderRefresh - Forces the view to be refreshed
     */
    _onRefreshNow: function (forceStreamRenderRefresh) {
        this.reload();
    }
});
