/** @odoo-module **/

import FieldHtml from 'web_editor.field.html';
import fieldRegistry from 'web.field_registry';
import MailEmojisMixin from '@mail/js/emojis_mixin';
import SocialPostFormatterMixin from 'social.post_formatter_mixin';

/**
 * Simple FieldHtml extension that will just wrap the emojis correctly.
 * See 'MailEmojisMixin' documentation for more information. Note that
 * few social media preview messages could be split into multiple elements
 * (for example, in twitter we want to highlight exceeding text in separate
 * span and that extra span might also contain emojis), so we simply format
 * all the '.o_social_preview_message' within field.
 */
var FieldPostPreview = FieldHtml.extend(MailEmojisMixin, SocialPostFormatterMixin, {
    _textToHtml: function (text) {
        var html = this._super.apply(this, arguments);
        var $html = $(html);
        $html.find('.o_social_preview_message').each((index, previewMessage) => {
            $(previewMessage).html(this._formatPost($(previewMessage).text().trim()));
        });

        return $html[0].outerHTML;
    }
});

fieldRegistry.add('social_post_preview', FieldPostPreview);

export default FieldPostPreview;
