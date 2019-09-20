odoo.define('social.kanban_field_emoji', function (require) {
"use strict";

var FieldRegistry = require('web.field_registry');
var FieldText = require('web.basic_fields').FieldText;
var SocialEmojisMixin = require('social.emoji_mixin');

var SocialKanbanEmojisWrapper = FieldText.extend(SocialEmojisMixin, {
    _render: function () {
        if (this.value) {
            this.$el.html(this._formatText(this.value));
        }
    }
});

FieldRegistry.add('social_kanban_field_emoji', SocialKanbanEmojisWrapper);

return SocialKanbanEmojisWrapper;

});
