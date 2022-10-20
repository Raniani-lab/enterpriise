/** @odoo-module */
import tour from "web_tour.tour";

tour.register(
    "web_studio_test_form_view_not_altered_by_studio_xml_edition",
    {
        test: true,
        url: "/web",
        sequence: 260
    },
    [
        {
            trigger: "a[data-menu-xmlid='web_studio.studio_test_partner_menu'"
        },
        {
            trigger: ".o_form_view .o_form_editable"
        },
        {
            trigger: ".o_web_studio_navbar_item a"
        },
        {
            trigger: ".o_web_studio_sidebar .o_web_studio_view"
        },
        {
            trigger: ".o_web_studio_xml_editor"
        },
        {
            trigger: ".o_web_studio_leave"
        },
        {
            trigger: ".o_form_view .o_form_editable"
        }
    ]
);
