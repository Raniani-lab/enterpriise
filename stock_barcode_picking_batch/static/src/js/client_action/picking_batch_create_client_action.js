odoo.define('stock_barcode_picking_batch.create_client_action', function (require) {
'use strict';

const core = require('web.core');
const AbstractAction = require('web.AbstractAction');

const QWeb = core.qweb;
const _t = core._t;

const BatchCreateClientAction = AbstractAction.extend({
    contentTemplate: 'stock_barcode_picking_batch_create_template',
    events: {
        'click .o_barcode_line': '_onClickLine',
        'click .o_confirm': '_onClickConfirm',
        'click .o_exit': '_onClickExit',
    },

    init: function (parent, action) {
        this._super(...arguments);
        this.batchPickingId = action.context.active_id;
    },

    willStart: function () {
        return Promise.all([
            this._super(...arguments),
            this._getState()
        ]);
    },

    start: function () {
        this.$('.o_content').addClass('o_barcode_client_action'); // reuse stylings
        return this._super(...arguments).then(() => this._loadPickingsLines());
    },

    /**
     * Make an rpc to get the state so we can handle refreshing of the page
     * and set new batch picking dependent values
     *
     * @private
     * @return {Promise}
     */
    _getState: function () {
        return this._rpc({
            model: 'stock.picking.batch',
            method: 'action_get_new_batch_status',
            args: [this.batchPickingId]
        }).then((res) => {
            if (res) {
                this.title = res.picking_batch_name;
                this.potentialPickings = res.allowed_picking_ids;
            }
        });
    },

    /**
     * Renders allowed pickings if they exist, otherwise hides `confirm button` and default message of
     * "no pickings to batch" is allowed to show. If user refreshes this page then
     * this.potentialPickings = undefined and page will default to "no pickings to batch" mode.
     *
     * @private
     */
    _loadPickingsLines: function () {
        if (this.potentialPickings && this.potentialPickings.length) {
            // remove default message about no pickings to batch
            this.$('.o_barcode_message').remove();

            const $body = this.$('.o_barcode_lines');
            // render and append the lines
            const $lines = $(QWeb.render('stock_barcode_picking_batch_create_lines_template', {
                lines: this.potentialPickings,
            }));
            $body.prepend($lines);
        } else {
            // remove confirm button when nothing to confirm
            this.$('.o_barcode_control').remove();
        }
    },

    /**
     * Handles the click on a line to tag picking to be part of batch.
     *
     * @private
     * @param {MouseEvent} ev
     */
    _onClickLine: function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        let target = ev.target;
        if (!target.classList.contains('o_barcode_line')) {
            target = $(target).parents('.o_barcode_line')[0];
        }
        if (target.classList.contains('o_selected')) {
            target.classList.remove('o_selected');
        } else {
            target.classList.add('o_selected');
        }
    },

    /**
     * Handles the click on the `confirm button`. Expects client action to not be reached if errors occur within rpc.
     *
     * @private
     * @param {MouseEvent} ev
     */
    _onClickConfirm: function (ev) {
        ev.stopPropagation();
        const selectedPickingIds = [];
        this.$('.o_selected').each(function() {
            selectedPickingIds.push(parseInt($(this).attr('data-id')));
        });
        if (selectedPickingIds.length && this.batchPickingId) {
            return this._rpc({
                model: 'stock.picking.batch',
                method: 'action_confirm_batch_picking',
                args: [this.batchPickingId, selectedPickingIds]
            }).then((res) => {
                if (res) {
                    this.do_action({
                        type: 'ir.actions.client',
                        tag: 'stock_barcode_picking_batch_client_action',
                        params: {
                            'model': 'stock.picking.batch',
                            'picking_batch_id': this.batchPickingId,
                        },
                    },
                    {replace_last_action: true,});
                }
            });
        } else {
            // No pickings selected or something went wrong and confirm button was clicked when it shouldn't have been possible
            this.do_warn(false,
                _t('No transfers were selected or something has gone wrong!'));
        }
    },

    /**
     * Handles clicking of `back button`
     *
     * @private
     * @param {MouseEvent} ev
     */
    _onClickExit: function (ev) {
        ev.stopPropagation();
        return this.trigger_up('history_back');
    },

});
core.action_registry.add('stock_barcode_picking_batch_create_client_action', BatchCreateClientAction);

return BatchCreateClientAction;
});
