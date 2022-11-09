/** @odoo-module **/

import { SocialPostFormatterMixin } from './social_post_formatter_mixin';

import { formatInteger } from '@web/views/fields/formatters';
import { KanbanRecord } from '@web/views/kanban/kanban_record';
import { patch } from '@web/core/utils/patch';
import { useService } from '@web/core/utils/hooks';

const { markup } = owl;

export const CANCEL_GLOBAL_CLICK = ["a", ".o_social_subtle_btn", "img"].join(",");
const DEFAULT_COMMENT_COUNT = 20;

export class StreamPostKanbanRecord extends KanbanRecord {

    setup() {
        super.setup();
        this.rpc = useService('rpc');
    }

    //---------------------------------------
    // Handlers
    //---------------------------------------

    /**
     * @override
     */
    onGlobalClick(ev) {
        if (ev.target.closest(CANCEL_GLOBAL_CLICK)) {
            return;
        }
        this.rootRef.el.querySelector('.o_social_comments').click();
    }

    //---------------------------------------
    // Private
    //---------------------------------------

    _updateLikesCount(userLikeField, likesCountField) {
        const userLikes = this.record[userLikeField].raw_value;
        let likesCount = this.record[likesCountField].raw_value;
        if (userLikes) {
            if (likesCount > 0) {
                likesCount--;
            }
        } else {
            likesCount++;
        }

        this.props.record.update({
            [userLikeField]: !userLikes,
            [likesCountField]: likesCount,
        });
    }

    /**
     * @deprecated will be removed in v16.1
     */
    _insertThousandSeparator(value) {
        return formatInteger(value);
    }

    formatPost(value) {
        return markup(this._formatPost(value));
    }

    //---------
    // Getters
    //---------

    get commentCount() {
        return this.props.commentCount || DEFAULT_COMMENT_COUNT;
    }

    /**
     * FIXME: this is done temporarily, waiting for these implemention details to be removed
     * from the arch.
     *
     * @override
     */
    get renderingContext() {
        return {
            ...super.renderingContext,
            _insertThousandSeparator: (value) => this._insertThousandSeparator(value),
            formatPost: (value) => this.formatPost(value),
        }
    }
}
patch(StreamPostKanbanRecord.prototype, 'social_post_formatter_mixin', SocialPostFormatterMixin);
