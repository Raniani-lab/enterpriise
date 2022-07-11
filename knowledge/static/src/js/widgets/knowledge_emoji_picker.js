/** @odoo-module **/

import Widget from 'web.Widget';
import { ComponentWrapper, WidgetAdapterMixin } from 'web.OwlCompatibility';
import EmojiPicker from '../../components/emoji_picker/emoji_picker.js';

const EmojiPickerWidget = Widget.extend(WidgetAdapterMixin, {
    /**
     * Mount the component and setup the Emoji click handler.
     *
     * @override
     */
    start: function () {
        this.component = new ComponentWrapper(this, EmojiPicker, {
            /**
             * @param {String} unicode
             */
            onClickEmoji: unicode => {
                this.trigger_up('emoji_click', {
                    articleId: this.articleId || false,
                    unicode: unicode || false,
                });
            },
        });
        return this.component.mount(this.el);
    },
    /**
     * Show the emojiPicker on target
     *
     * @param {integer} articleId article id
     */
    setArticleId: function (articleId) {
        this.articleId = articleId;
    },
});

export default EmojiPickerWidget;
