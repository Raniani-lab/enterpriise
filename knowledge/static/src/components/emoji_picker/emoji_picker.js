/** @odoo-module **/

import emojis from '@mail/js/emojis';
import { useService } from "@web/core/utils/hooks";
const { Component } = owl;

class LegacyEmoji extends Component {
    /**
     * @override
     */
    setup() {
        // Mock the template variables:
        this.className = '';
        this.emojiListView = this.props.emojiListView;
    }
}

LegacyEmoji.template = 'mail.LegacyEmoji';
LegacyEmoji.props = {
    emojiView: Object
};

class EmojiPicker extends Component {
    /**
     * @override
     */
    setup() {
        this.orm = useService('orm');

        // Mock the template variables:
        this.className = '';
        const viewEventHandlers = {
            /**
             * @param {Event} event
             */
            onClickEmoji: async event => {
                await this.orm.write('knowledge.article', [this.props.data.articleId], {'icon': event.target.dataset.unicode});
                this.props.notifyChangedEmoji(event.target.dataset.unicode, this.props.data.articleId);
            },
        };
        this.emojiListView = {
            emojiViews: emojis.map((emoji, index) => {
                return {
                    localId: index,
                    emoji: emoji,
                    emojiListView: viewEventHandlers
                };
            })
        };
    }

    async onRemoveEmoji() {
        await this.orm.write('knowledge.article', [this.props.data.articleId], {'icon': false});
        this.props.notifyChangedEmoji(false, this.props.data.articleId);
    }
}

EmojiPicker.template = 'knowledge.LegacyEmojiList';
EmojiPicker.props = ['notifyChangedEmoji', 'data'];
EmojiPicker.components = { LegacyEmoji };

export default EmojiPicker;
