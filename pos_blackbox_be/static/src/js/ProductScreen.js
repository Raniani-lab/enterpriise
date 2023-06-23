/** @odoo-module **/

    import ProductScreen from "point_of_sale.ProductScreen";
    import Registries from "point_of_sale.Registries";

    const PosBlackBoxBeProductScreen = ProductScreen => class extends ProductScreen {
        disallowLineQuantityChange() {
            let result = super.disallowLineQuantityChange();
            return (this.env.pos.useBlackBoxBe() && this.numpadMode === 'quantity') || result;
        }
    };

    Registries.Component.extend(ProductScreen, PosBlackBoxBeProductScreen);

    export default ProductScreen;
