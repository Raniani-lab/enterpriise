/** @odoo-module **/

import { TextField } from "@web/views/fields/text/text_field";
import { patch } from '@web/core/utils/patch';
import { registry } from "@web/core/registry";

import { SocialPostFormatterMixin } from "../social_post_formatter_mixin";

const { markup } = owl;

export class PostFormatterField extends TextField {
    get formattedPost() {
        return markup(this._formatPost(this.props.value || ''));
    }
}
patch(PostFormatterField.prototype, 'social.PostFormatterField', SocialPostFormatterMixin);
PostFormatterField.template = 'social.PostFormatterField';

registry.category('fields').add('social_post_formatter', PostFormatterField);
