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
            trigger: "a[data-menu-xmlid='web_studio.studio_test_partner_menu']"
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
            extra_trigger: ".o_ace_view_editor",
            trigger: ".o_web_studio_leave"
        },
        {
            trigger: ".o_form_view .o_form_editable"
        }
    ]
);

/* global ace */
tour.register(
    "web_studio_test_edit_with_xml_editor",
    {
        test: true,
        url: "/web",
        sequence: 260
    },
    [
        {
            trigger: "a[data-menu-xmlid='web_studio.studio_test_partner_menu']"
        },
        {
            extra_trigger: ".someDiv",
            trigger: ".o_web_studio_navbar_item a"
        },
        {
            trigger: ".o_web_studio_sidebar .o_web_studio_view"
        },
        {
            trigger: ".o_web_studio_xml_editor"
        },
        {
            extra_trigger: ".o_ace_view_editor",
            trigger: ".select2-container:not(.d-none)",
            run() {
                const aceViewList = document.querySelector("#ace-view-list");
                const studioViewItem = Array.from(aceViewList.querySelectorAll("option")).filter(
                    (el) => {
                        return el.textContent.includes("Odoo Studio");
                    }
                )[0];

                if (!studioViewItem) {
                    throw new Error("There is no studio view");
                }

                const select2 = $(aceViewList).select2();
                select2.val(studioViewItem.value).trigger("change");
            }
        },
        {
            trigger: ".ace_content",
            run() {
                ace.edit("ace-view-editor").setValue("<data/>");
            }
        },
        {
            trigger: ".o_ace_view_editor .o_button_section [data-action='save']"
        },
        {
            trigger: ".o_web_studio_snackbar_icon:not('.fa-spin')"
        },
        {
            trigger: ".o_form_view",
            run() {
                if (document.querySelector(".someDiv")) {
                    throw new Error("The edition of the view's arch via the xml editor failed");
                }
            }
        }
    ]
);
