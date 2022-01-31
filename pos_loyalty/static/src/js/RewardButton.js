odoo.define('pos_loyalty.RewardButton', function(require) {
'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const ProductScreen = require('point_of_sale.ProductScreen');
    const { useListener } = require("@web/core/utils/hooks");
    const Registries = require('point_of_sale.Registries');

    class RewardButton extends PosComponent {
        setup() {
            super.setup();
            useListener('click', this.onClick);
        }
        is_available() {
            const order = this.env.pos.get_order();
            return order ? order.get_available_rewards().length > 0 : false;
        }
        async onClick() {
            let order = this.env.pos.get_order();
            let partner = order.get_partner();
            if (!partner) {
                // IMPROVEMENT: This code snippet is similar to selectPartner of PaymentScreen.
                const {
                    confirmed,
                    payload: newPartner,
                } = await this.showTempScreen('PartnerListScreen', { partner });
                if (confirmed) {
                    order.set_partner(newPartner);
                    order.updatePricelist(newPartner);
                }
                return;
            }

            var rewards = order.get_available_rewards();
            if (rewards.length === 0) {
                await this.showPopup('ErrorPopup', {
                    title: this.env._t('No Rewards Available'),
                    body: this.env._t('There are no rewards available for this customer as part of the loyalty program'),
                });
                return;
            } else if (rewards.length === 1 && this.env.pos.loyalty.rewards.length === 1) {
                order.apply_reward(rewards[0]);
                return;
            } else {
                const rewardsList = rewards.map(reward => ({
                    id: reward.id,
                    label: reward.name,
                    item: reward,
                }));

                const { confirmed, payload: selectedReward } = await this.showPopup('SelectionPopup',
                    {
                        title: this.env._t('Please select a reward'),
                        list: rewardsList,
                    }
                );

                if(confirmed)
                    order.apply_reward(selectedReward);
                return;
            }
        }
    }
    RewardButton.template = 'RewardButton';

    ProductScreen.addControlButton({
        component: RewardButton,
        condition: function() {
            return this.env.pos.config.module_pos_loyalty;
        },
    });

    Registries.Component.add(RewardButton);

    return RewardButton;
});
