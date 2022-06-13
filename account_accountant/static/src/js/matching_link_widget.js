/** @odoo-module **/
import fieldRegistry from 'web.field_registry';
import { FieldChar } from 'web.basic_fields';
import { _lt } from 'web.core';

const MatchingLink = FieldChar.extend({
    events: Object.assign({}, FieldChar.prototype.events, {
        'click .match_button': '_onOpenMatch',
    }),
    _renderReadonly: function() {
        this._super(...arguments);
        if(!this.value && this.recordData.is_account_reconcile) {
            this.$el.append("<button class='journal_item_matching_button match_button'>" + _lt('Match') + "</button>");
        }
    },
    _onOpenMatch: function(ev) {
        var self = this;
        this._rpc({
            model: 'account.move.line',
            method: 'action_reconcile',
            args: [this.res_id],
        }).then(function (actionData){
            return self.do_action(actionData);
        });
    }
});
fieldRegistry.add('matching_link_widget', MatchingLink);
